import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { User, Users } from "lucide-react";
import { computeTreeLayout, computeConnectors, TreeNodePosition, ConnectorSegment } from "@/lib/tree-layout";
import { supabase } from "@/integrations/supabase/client";

interface TalentEngagementWithData extends TalentEngagement {
  talent: Talent;
}

export type CanvasInteractionMode = "browse" | "edit";
export type DropZone = "top" | "bottom" | "left" | "right" | "company_root";

interface AccountCanvasProps {
  account: Account;
  onContactClick: (contact: Contact) => void;
  onTalentClick?: (talent: Talent, engagement: TalentEngagement) => void;
  highlightedContactIds?: string[];
  showTalentOverlay?: boolean;
  talentEngagements?: TalentEngagementWithData[];
  interactionMode?: CanvasInteractionMode;
  selectedNodeId?: string | null;
  onNodeSelect?: (contactId: string | null) => void;
  onStructuralDrop?: (draggedContactId: string, targetContactId: string | null, zone: DropZone) => void;
  workspaceId?: string;
}
export interface AccountCanvasRef {
  clearSearch: () => void;
  highlightContacts: (contactIds: string[]) => void;
  getNodeScreenPosition: (contactId: string) => { x: number; y: number } | null;
}

interface ContactNodeData {
  contact: Contact;
  group: Group;
  originalStroke?: string | null;
  originalStrokeWidth?: number;
  anchorPoints: Point[];
  originalPosition: { x: number; y: number };
}

interface TalentNodeData {
  engagement: TalentEngagementWithData;
  group: Group;
}

export const AccountCanvas = forwardRef<AccountCanvasRef, AccountCanvasProps>(({ 
  account, 
  onContactClick,
  onTalentClick,
  highlightedContactIds = [],
  showTalentOverlay = false,
  talentEngagements = [],
  interactionMode = "browse",
  selectedNodeId = null,
  onNodeSelect,
  onStructuralDrop,
  workspaceId,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedNodes, setMatchedNodes] = useState<ContactNodeData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contactNodesRef = useRef<Map<string, ContactNodeData>>(new Map());
  const talentNodesRef = useRef<Map<string, TalentNodeData>>(new Map());
  const [showCompanyHover, setShowCompanyHover] = useState(false);
  const [companyHoverPosition, setCompanyHoverPosition] = useState({ x: 0, y: 0 });
  
  // Refs for interaction mode (so canvas event handlers always have current values)
  const interactionModeRef = useRef(interactionMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  
  const onNodeSelectRef = useRef(onNodeSelect);
  const onContactClickRef = useRef(onContactClick);
  
  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  const companyNodeRef = useRef<Group | null>(null);
  const companyMoveHandlerRef = useRef<any>(null);
  const companyUpHandlerRef = useRef<any>(null);
  const isCanvasDisposedRef = useRef(false);
  const hierarchyLinesRef = useRef<Line[]>([]);
  const prevContactsRef = useRef<string>(""); // serialized contact ids+managers for diff detection
  const isAnimatingLayoutRef = useRef(false);
  
  // Drag mode: IDLE | DRAGGING | COMMITTING — prevents concurrent commits
  const dragModeRef = useRef<"IDLE" | "DRAGGING" | "COMMITTING">("IDLE");
  
  // RAF throttling refs
  const wheelRafRef = useRef<number | null>(null);
  
  // Smart snap system refs
  const guideLinesToRef = useRef<(Line | Rect)[]>([]);
  const snapResultRef = useRef<{ targetId: string | null; zone: DropZone } | null>(null);
  const autoPanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStructuralDropRef = useRef(onStructuralDrop);
  useEffect(() => { onStructuralDropRef.current = onStructuralDrop; }, [onStructuralDrop]);

  // ── Carry Mode refs ──
  const isCarryingRef = useRef(false);
  const carriedContactIdRef = useRef<string | null>(null);
  const ghostNodeRef = useRef<Group | null>(null);
  const spacebarPanRef = useRef(false);
  const accountContactsRef = useRef<Contact[]>([]);
  const carryStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const carryContactPendingRef = useRef<string | null>(null);



  // Snap constants
  const AUTO_PAN_EDGE = 60;
  const AUTO_PAN_SPEED = 8;
  const COMPANY_SNAP_RADIUS = 70;
  const ZONE_DETECT_RADIUS = 120; // px distance to start zone detection
  
  // RAF throttle for guide line updates during drag
  const guideRafRef = useRef<number | null>(null);
  const pendingGuideUpdateRef = useRef<(() => void) | null>(null);
  
  // Guide line / hint management
  const clearGuideLines = useCallback((canvas: FabricCanvas) => {
    guideLinesToRef.current.forEach(obj => {
      try { canvas.remove(obj); } catch {}
    });
    guideLinesToRef.current = [];
    snapResultRef.current = null;
  }, []);
  
  const addGuideRect = useCallback((canvas: FabricCanvas, left: number, top: number, width: number, height: number, color: string, opacity = 0.3) => {
    const rect = new Rect({
      left, top, width, height,
      fill: color,
      opacity,
      selectable: false,
      evented: false,
      rx: 4, ry: 4,
    });
    canvas.add(rect);
    guideLinesToRef.current.push(rect);
    return rect;
  }, []);

  const addGuideLine = useCallback((canvas: FabricCanvas, x1: number, y1: number, x2: number, y2: number, color = "hsl(221 83% 53%)") => {
    const line = new Line([x1, y1, x2, y2], {
      stroke: color,
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      opacity: 0.7,
    });
    canvas.add(line);
    guideLinesToRef.current.push(line);
  }, []);

  // Cycle detection: returns true if `targetId` is a descendant of `draggedId`
  const isDescendant = useCallback((draggedId: string, targetId: string, contacts: Contact[]): boolean => {
    const childrenMap = new Map<string, string[]>();
    contacts.forEach(c => {
      if (c.managerId) {
        if (!childrenMap.has(c.managerId)) childrenMap.set(c.managerId, []);
        childrenMap.get(c.managerId)!.push(c.id);
      }
    });
    const visited = new Set<string>();
    const stack = [draggedId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const kids = childrenMap.get(cur) || [];
      for (const kid of kids) {
        if (kid === targetId) return true;
        stack.push(kid);
      }
    }
    return false;
  }, []);

  // 3-zone detection: top 30% = sibling-before, bottom 30% = sibling-after, center 40% = child
  const detectZone = useCallback((dragX: number, dragY: number, targetX: number, targetY: number, nodeW: number, nodeH: number): DropZone | null => {
    const dx = dragX - targetX;
    const dy = dragY - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > ZONE_DETECT_RADIUS) return null;

    // Relative position within target bounding box
    const relY = dy + nodeH / 2; // 0 = top edge, nodeH = bottom edge
    if (relY < 0 || relY > nodeH) {
      // Outside vertical bounds — use proximity
      return dy < 0 ? "top" : "bottom";
    }
    const pct = relY / nodeH;
    if (pct < 0.3) return "top";       // sibling before
    if (pct > 0.7) return "bottom";    // sibling after
    return "left";                      // center → child (reuse "left" as child zone since it maps to center)
  }, []);

  // Auto-pan when near edges — rate-limited, subtle
  const startAutoPan = useCallback((canvas: FabricCanvas, mouseX: number, mouseY: number) => {
    const cw = canvas.width!;
    const ch = canvas.height!;
    let dx = 0, dy = 0;
    
    if (mouseX < AUTO_PAN_EDGE) dx = AUTO_PAN_SPEED;
    else if (mouseX > cw - AUTO_PAN_EDGE) dx = -AUTO_PAN_SPEED;
    if (mouseY < AUTO_PAN_EDGE) dy = AUTO_PAN_SPEED;
    else if (mouseY > ch - AUTO_PAN_EDGE) dy = -AUTO_PAN_SPEED;
    
    if (dx === 0 && dy === 0) {
      stopAutoPan();
      return;
    }
    
    // Don't restart if already running with same direction
    if (autoPanIntervalRef.current) return;
    
    autoPanIntervalRef.current = setInterval(() => {
      if (isCanvasDisposedRef.current || !isCarryingRef.current) { stopAutoPan(); return; }
      try {
        const vpt = canvas.viewportTransform!;
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.requestRenderAll();
      } catch { stopAutoPan(); }
    }, 32); // 30fps is enough for subtle auto-pan
  }, []);
  
  const stopAutoPan = useCallback(() => {
    if (autoPanIntervalRef.current) {
      clearInterval(autoPanIntervalRef.current);
      autoPanIntervalRef.current = null;
    }
  }, []);

  // ── Carry Mode functions ──
  const startCarry = useCallback((canvas: FabricCanvas, contactId: string) => {
    const nodeData = contactNodesRef.current.get(contactId);
    if (!nodeData || isCarryingRef.current) return;
    isCarryingRef.current = true;
    carriedContactIdRef.current = contactId;
    dragModeRef.current = "DRAGGING";
    nodeData.group.set({ opacity: 0.3 });
    const cardBg = nodeData.group.getObjects()[0] as Rect;
    cardBg.set({ strokeDashArray: [6, 4], stroke: 'hsl(214 32% 70%)', strokeWidth: 2 });
    hierarchyLinesRef.current.forEach(l => l.set({ opacity: 0.2 }));
    const contact = nodeData.contact;
    const center = nodeData.group.getCenterPoint();
    const ghostBg = new Rect({ width: 180, height: 90, fill: 'white', stroke: 'hsl(221 83% 53%)', strokeWidth: 2, rx: 8, ry: 8, left: -90, top: -45 });
    const ghostName = new Text(contact.name, { fontSize: 11, fontWeight: '600', fill: 'hsl(222 47% 11%)', left: -40, top: -15, width: 110 });
    const ghostTitle = new Text(contact.title || '', { fontSize: 9, fill: 'hsl(215 16% 47%)', left: -40, top: 2, width: 110 });
    const ghost = new Group([ghostBg, ghostName, ghostTitle], {
      left: center.x, top: center.y, originX: 'center', originY: 'center',
      selectable: false, evented: false, opacity: 0.85,
      shadow: { color: 'rgba(0,0,0,0.15)', blur: 12, offsetX: 0, offsetY: 4 } as any,
    });
    canvas.add(ghost);
    canvas.bringObjectToFront(ghost);
    ghostNodeRef.current = ghost;
    canvas.requestRenderAll();
  }, []);

  const endCarry = useCallback((canvas: FabricCanvas, forceRevert: boolean = false) => {
    if (!isCarryingRef.current) return;
    stopAutoPan();
    if (guideRafRef.current !== null) { cancelAnimationFrame(guideRafRef.current); guideRafRef.current = null; }
    clearGuideLines(canvas);
    const carriedId = carriedContactIdRef.current;
    const result = forceRevert ? null : snapResultRef.current;
    // Remove ghost
    if (ghostNodeRef.current) { try { canvas.remove(ghostNodeRef.current); } catch {} ghostNodeRef.current = null; }
    // Restore original node appearance
    if (carriedId) {
      const nodeData = contactNodesRef.current.get(carriedId);
      if (nodeData) {
        nodeData.group.set({ opacity: 1 });
        const cardBg = nodeData.group.getObjects()[0] as Rect;
        cardBg.set({ strokeDashArray: undefined as any, stroke: 'hsl(214 32% 91%)', strokeWidth: 1 });
      }
    }
    // Restore connector opacity
    hierarchyLinesRef.current.forEach(l => { try { l.set({ opacity: 1 }); } catch {} });
    // Commit or revert
    if (result && carriedId) {
      dragModeRef.current = "COMMITTING";
      onStructuralDropRef.current?.(carriedId, result.targetId, result.zone);
      setTimeout(() => { dragModeRef.current = "IDLE"; }, 300);
    } else {
      // REVERT: no valid snap target — card stays in original position (no DB change)
      dragModeRef.current = "IDLE";
    }
    // Reset all carry state
    isCarryingRef.current = false;
    carriedContactIdRef.current = null;
    carryContactPendingRef.current = null;
    carryStartPosRef.current = null;
    snapResultRef.current = null;
    spacebarPanRef.current = false;
    canvas.requestRenderAll();
  }, [stopAutoPan, clearGuideLines]);

  const computeCarrySnaps = useCallback((canvas: FabricCanvas) => {
    if (!isCarryingRef.current || !ghostNodeRef.current) return;
    clearGuideLines(canvas);
    const pointer = ghostNodeRef.current.getCenterPoint();
    const dragX = pointer.x, dragY = pointer.y;
    const carriedId = carriedContactIdRef.current;
    if (!carriedId) return;
    const NODE_W = 180, NODE_H = 90;
    if (companyNodeRef.current) {
      const cc = companyNodeRef.current.getCenterPoint();
      if (Math.sqrt((dragX - cc.x) ** 2 + (dragY - cc.y) ** 2) < COMPANY_SNAP_RADIUS) {
        addGuideRect(canvas, cc.x - 50, cc.y + 30, 100, 30, "hsl(221 83% 53%)", 0.4);
        addGuideLine(canvas, cc.x, cc.y + 40, dragX, dragY - NODE_H / 2, "hsl(221 83% 53%)");
        snapResultRef.current = { targetId: null, zone: "company_root" };
        canvas.requestRenderAll();
        return;
      }
    }
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform!;
    const vpL = -vpt[4] / zoom, vpT = -vpt[5] / zoom;
    const vpR = vpL + canvas.width! / zoom, vpB = vpT + canvas.height! / zoom;
    const M = 300;
    let best: { id: string; zone: DropZone; dist: number } | null = null;
    contactNodesRef.current.forEach((od, oid) => {
      if (oid === carriedId) return;
      if (isDescendant(carriedId, oid, accountContactsRef.current)) return;
      const oc = od.group.getCenterPoint();
      if (oc.x < vpL - M || oc.x > vpR + M || oc.y < vpT - M || oc.y > vpB + M) return;
      const zone = detectZone(dragX, dragY, oc.x, oc.y, NODE_W, NODE_H);
      if (!zone) return;
      const dist = Math.sqrt((dragX - oc.x) ** 2 + (dragY - oc.y) ** 2);
      if (!best || dist < best.dist) best = { id: oid, zone, dist };
    });
    if (best) {
      const td = contactNodesRef.current.get(best.id)!;
      const tc = td.group.getCenterPoint();
      const hw = NODE_W / 2, hh = NODE_H / 2;
      const siblingColor = "hsl(270 70% 55%)";
      const childColor = "hsl(142 71% 45%)";
      switch (best.zone) {
        case "top":
          // Insertion line above target = "sibling before"
          addGuideRect(canvas, tc.x - hw, tc.y - hh - 6, NODE_W, 4, siblingColor, 0.7);
          break;
        case "bottom":
          // Insertion line below target = "sibling after"
          addGuideRect(canvas, tc.x - hw, tc.y + hh + 2, NODE_W, 4, siblingColor, 0.7);
          break;
        case "left": // center zone = make child
          addGuideRect(canvas, tc.x - hw + 4, tc.y - hh + 4, NODE_W - 8, NODE_H - 8, childColor, 0.15);
          addGuideLine(canvas, tc.x, tc.y + hh, dragX, dragY - NODE_H / 2, childColor);
          break;
      }
      snapResultRef.current = { targetId: best.id, zone: best.zone };
    } else {
      snapResultRef.current = null;
    }
    canvas.requestRenderAll();
  }, [clearGuideLines, addGuideRect, addGuideLine, detectZone, isDescendant]);


  const companyHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCompanyDraggingRef = useRef(false);
  const companyDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const HOVER_DELAY = 700;
  const DRAG_THRESHOLD = 5;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    isCanvasDisposedRef.current = false;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "hsl(210 40% 98%)",
      selection: false,
    });

    // Enable zoom with RAF throttling
    canvas.on('mouse:wheel', (opt) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      if (wheelRafRef.current !== null) return; // Skip if RAF already scheduled
      const delta = opt.e.deltaY;
      const offsetX = opt.e.offsetX;
      const offsetY = opt.e.offsetY;
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 3) zoom = 3;
        if (zoom < 0.3) zoom = 0.3;
        canvas.zoomToPoint(new Point(offsetX, offsetY), zoom);
      });
    });

    // Pan on background drag
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on('mouse:down', (opt) => {
      if (isCarryingRef.current) return; // Don't start pan during carry
      const evt = opt.e as MouseEvent;
      if (!opt.target) {
        isDragging = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.setCursor('grab');
      }
    });

    canvas.on('mouse:move', (opt) => {
      const evt = opt.e as MouseEvent;

      // Check if we should start carry (drag threshold)
      if (carryContactPendingRef.current && !isCarryingRef.current && carryStartPosRef.current) {
        const dx = Math.abs(evt.clientX - carryStartPosRef.current.x);
        const dy = Math.abs(evt.clientY - carryStartPosRef.current.y);
        if (dx > 5 || dy > 5) {
          startCarry(canvas, carryContactPendingRef.current);
          carryContactPendingRef.current = null;
        }
      }

      // Carry mode: move ghost + compute snaps
      if (isCarryingRef.current && ghostNodeRef.current) {
        // Spacebar pan during carry
        if (spacebarPanRef.current) {
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.movementX;
          vpt[5] += evt.movementY;
          canvas.requestRenderAll();
          return; // Don't update ghost or snaps while panning
        }
        // Ghost follows cursor (canvas coords)
        const pointer = canvas.getPointer(evt);
        ghostNodeRef.current.set({ left: pointer.x, top: pointer.y });
        ghostNodeRef.current.setCoords();
        // Auto-pan near edges (subtle)
        startAutoPan(canvas, evt.offsetX, evt.offsetY);
        // Throttled snap detection (viewport-filtered)
        if (guideRafRef.current === null) {
          guideRafRef.current = requestAnimationFrame(() => {
            guideRafRef.current = null;
            if (isCarryingRef.current) computeCarrySnaps(canvas);
          });
        }
        canvas.requestRenderAll();
        return;
      }

      // Normal pan
      if (isDragging) {
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - lastPosX;
        vpt[5] += evt.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:up', () => {
      // Carry mode drop
      if (isCarryingRef.current) {
        endCarry(canvas);
        return;
      }
      // Cancel pending carry (was a click, not a drag)
      carryContactPendingRef.current = null;
      carryStartPosRef.current = null;

      canvas.setViewportTransform(canvas.viewportTransform!);
      isDragging = false;
      canvas.selection = false;
      canvas.setCursor('default');
    });

    setFabricCanvas(canvas);

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        canvas.renderAll();
      }
    };

    window.addEventListener("resize", handleResize);

    // Keyboard handlers for carry mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isCarryingRef.current) {
        e.preventDefault();
        spacebarPanRef.current = true;
        canvas.setCursor('grab');
      }
      if (e.code === 'Escape' && isCarryingRef.current) {
        endCarry(canvas, true); // force revert on Escape
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacebarPanRef.current = false;
        if (isCarryingRef.current) canvas.setCursor('default');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
      stopAutoPan();
      isCanvasDisposedRef.current = true;
      canvas.dispose();
    };
  }, []);

  // Shared edge drawing function usable both in animated path and full rebuild
  const drawFreshEdgesFromPositions = useCallback((canvas: FabricCanvas, cw: number, nodeW: number, nodeH: number, depthMap: Map<string, number>, animated: boolean) => {
    const animateLineDrawIn = (line: Line, duration: number = 200) => {
      if (isCanvasDisposedRef.current) return;
      const targetX2 = line.x2!;
      const targetY2 = line.y2!;
      const startX = line.x1!;
      const startY = line.y1!;
      line.set({ x2: startX, y2: startY, opacity: 0 });
      line.setCoords();
      const steps = Math.max(1, Math.round(duration / 16));
      let step = 0;
      const tick = () => {
        if (isCanvasDisposedRef.current) return;
        step++;
        const t = step / steps;
        const eased = 1 - (1 - t) * (1 - t);
        line.set({
          x2: startX + (targetX2 - startX) * eased,
          y2: startY + (targetY2 - startY) * eased,
          opacity: eased,
        });
        line.setCoords();
        canvas.requestRenderAll();
        if (step < steps) requestAnimationFrame(tick);
        else { line.set({ opacity: 1 }); canvas.requestRenderAll(); }
      };
      requestAnimationFrame(tick);
    };

    contactNodesRef.current.forEach((childData, childId) => {
      const contact = childData.contact;
      const childCenter = childData.group.getCenterPoint();
      const depth = depthMap.get(childId) || 1;
      const lightness = Math.min(70 + depth * 3, 85);
      const strokeColor = `hsl(214 32% ${lightness}%)`;
      const baseStrokeWidth = depth === 0 ? 3 : 2;

      if (contact.managerId && contactNodesRef.current.has(contact.managerId)) {
        const parentData = contactNodesRef.current.get(contact.managerId)!;
        const parentCenter = parentData.group.getCenterPoint();
        const parentBottomY = parentCenter.y + nodeH / 2;
        const childTopY = childCenter.y - nodeH / 2;
        const midY = parentBottomY + (childTopY - parentBottomY) / 2;

        const seg1 = new Line([parentCenter.x, parentBottomY, parentCenter.x, midY], { stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false });
        const seg2 = new Line([parentCenter.x, midY, childCenter.x, midY], { stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false });
        const seg3 = new Line([childCenter.x, midY, childCenter.x, childTopY], { stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false });

        [seg1, seg2, seg3].forEach(seg => {
          canvas.add(seg);
          canvas.sendObjectToBack(seg);
          hierarchyLinesRef.current.push(seg);
          if (animated) animateLineDrawIn(seg, 200);
        });
      } else if (!contact.managerId) {
        const companyBottomY = 120;
        const childTopY = childCenter.y - nodeH / 2;
        const midY = companyBottomY + (childTopY - companyBottomY) / 2;

        const seg1 = new Line([cw / 2, companyBottomY, cw / 2, midY], { stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false });
        const seg2 = new Line([cw / 2, midY, childCenter.x, midY], { stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false });
        const seg3 = new Line([childCenter.x, midY, childCenter.x, childTopY], { stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false });

        [seg1, seg2, seg3].forEach(seg => {
          canvas.add(seg);
          canvas.sendObjectToBack(seg);
          hierarchyLinesRef.current.push(seg);
          if (animated) animateLineDrawIn(seg, 200);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !account || isCanvasDisposedRef.current) return;
    accountContactsRef.current = account.contacts;

    const canvasW = fabricCanvas.width!;
    const NODE_W = 180;
    const NODE_H = 90;

    // Compute hierarchy fingerprint to detect hierarchy-only changes
    const contactFingerprint = account.contacts
      .map(c => `${c.id}:${c.managerId || ''}`)
      .sort()
      .join('|');
    const contactIdSet = account.contacts.map(c => c.id).sort().join(',');
    const prevFingerprint = prevContactsRef.current;
    
    // Check if this is a hierarchy-only change (same contacts, different managers)
    const prevIdSet = prevFingerprint.split('|').map(s => s.split(':')[0]).filter(Boolean).sort().join(',');
    const isHierarchyOnlyChange = prevFingerprint !== '' && prevIdSet === contactIdSet && prevFingerprint !== contactFingerprint;
    
    prevContactsRef.current = contactFingerprint;

    if (isHierarchyOnlyChange && contactNodesRef.current.size > 0) {
      // ── Animate nodes to new positions (smooth post-drop transition) ──
      const treePositions = computeTreeLayout(
        account.contacts.map(c => ({ id: c.id, managerId: c.managerId || null })),
        { nodeWidth: NODE_W, nodeHeight: NODE_H, horizontalGap: 40, verticalGap: 80, rootY: 220, centerX: canvasW / 2 }
      );

      // Remove old connectors immediately
      hierarchyLinesRef.current.forEach(line => { try { fabricCanvas.remove(line); } catch {} });
      hierarchyLinesRef.current = [];

      // Update parent/children maps for hover highlighting
      const parentMap = new Map<string, string>();
      const childrenMap = new Map<string, string[]>();
      const depthMap = new Map<string, number>();
      account.contacts.forEach(c => {
        if (c.managerId) {
          parentMap.set(c.id, c.managerId);
          if (!childrenMap.has(c.managerId)) childrenMap.set(c.managerId, []);
          childrenMap.get(c.managerId)!.push(c.id);
        }
      });

      isAnimatingLayoutRef.current = true;
      const ANIM_DURATION = 250; // ms
      const ANIM_STEPS = Math.round(ANIM_DURATION / 16);

      // Collect start/end positions
      const animations: { nodeData: ContactNodeData; startX: number; startY: number; endX: number; endY: number; depth: number }[] = [];
      for (const pos of treePositions) {
        const nodeData = contactNodesRef.current.get(pos.contactId);
        if (!nodeData) continue;
        const currentCenter = nodeData.group.getCenterPoint();
        animations.push({
          nodeData,
          startX: currentCenter.x,
          startY: currentCenter.y,
          endX: pos.x,
          endY: pos.y,
          depth: pos.depth,
        });
        depthMap.set(pos.contactId, pos.depth);
        // Update stored contact data with new managerId
        const updatedContact = account.contacts.find(c => c.id === pos.contactId);
        if (updatedContact) nodeData.contact = updatedContact;
        nodeData.originalPosition = { x: pos.x, y: pos.y };
      }

      let step = 0;
      const tick = () => {
        if (isCanvasDisposedRef.current) { isAnimatingLayoutRef.current = false; return; }
        step++;
        const t = step / ANIM_STEPS;
        // Ease-out quad
        const eased = 1 - (1 - t) * (1 - t);

        for (const anim of animations) {
          const newX = anim.startX + (anim.endX - anim.startX) * eased;
          const newY = anim.startY + (anim.endY - anim.startY) * eased;
          anim.nodeData.group.set({ left: newX, top: newY });
          anim.nodeData.group.setCoords();
        }

        fabricCanvas.requestRenderAll();

        if (step < ANIM_STEPS) {
          requestAnimationFrame(tick);
        } else {
          // Animation complete: rebuild connectors with draw-in
          isAnimatingLayoutRef.current = false;
          // Ensure final positions are exact
          for (const anim of animations) {
            anim.nodeData.group.set({ left: anim.endX, top: anim.endY });
            anim.nodeData.group.setCoords();
          }
          // Rebuild edges with animated draw-in
          const rebuildEdgesAnimated = () => {
            hierarchyLinesRef.current.forEach(line => { try { fabricCanvas.remove(line); } catch {} });
            hierarchyLinesRef.current = [];
            drawFreshEdgesFromPositions(fabricCanvas, canvasW, NODE_W, NODE_H, depthMap, true);
          };
          rebuildEdgesAnimated();
          fabricCanvas.requestRenderAll();
        }
      };
      requestAnimationFrame(tick);
      return;
    }

    // ── Full rebuild (initial render or contact set changed) ──
    try {
      fabricCanvas.clear();
    } catch {
      // Canvas context already disposed (HMR / strict mode) — skip rebuild
      return;
    }
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();
    hierarchyLinesRef.current = [];

    // canvasW, NODE_W, NODE_H already declared above

    // ── Company node at top ──
    const companyNode = createCompanyNode(account.name, canvasW / 2, 80);
    
    // Helper to cancel hover timer
    const cancelCompanyHoverTimer = () => {
      if (companyHoverTimerRef.current) {
        clearTimeout(companyHoverTimerRef.current);
        companyHoverTimerRef.current = null;
      }
    };

    companyNode.on('mouseover', function() {
      if (isCompanyDraggingRef.current) return;
      (this as FabricObject).set({ 
        shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 4 }
      });
      fabricCanvas.renderAll();
      cancelCompanyHoverTimer();
      companyHoverTimerRef.current = setTimeout(() => {
        if (!isCompanyDraggingRef.current) setShowCompanyHover(true);
      }, HOVER_DELAY);
    });

    companyNode.on('mouseout', function() {
      cancelCompanyHoverTimer();
      (this as FabricObject).set({ shadow: null });
      fabricCanvas.renderAll();
      setShowCompanyHover(false);
    });

    let companyLastPosX = 0;
    let companyLastPosY = 0;

    companyNode.on('mousedown', (opt) => {
      const evt = opt.e as MouseEvent;
      companyDragStartPosRef.current = { x: evt.clientX, y: evt.clientY };
      companyLastPosX = evt.clientX;
      companyLastPosY = evt.clientY;
      isCompanyDraggingRef.current = false;
      cancelCompanyHoverTimer();
    });

    // Remove previous company-drag listeners to prevent accumulation
    fabricCanvas.off('mouse:move', companyMoveHandlerRef.current as any);
    fabricCanvas.off('mouse:up', companyUpHandlerRef.current as any);
    
    const companyMoveHandler = (opt: any) => {
      if (!companyDragStartPosRef.current) return;
      const evt = opt.e as MouseEvent;
      if (evt.clientX === undefined) return;
      const dx = Math.abs(evt.clientX - companyDragStartPosRef.current.x);
      const dy = Math.abs(evt.clientY - companyDragStartPosRef.current.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        if (!isCompanyDraggingRef.current) {
          isCompanyDraggingRef.current = true;
          cancelCompanyHoverTimer();
          setShowCompanyHover(false);
        }
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] += evt.clientX - companyLastPosX;
        vpt[5] += evt.clientY - companyLastPosY;
        fabricCanvas.requestRenderAll();
      }
      companyLastPosX = evt.clientX;
      companyLastPosY = evt.clientY;
    };

    const companyUpHandler = () => {
      if (companyDragStartPosRef.current) {
        setTimeout(() => {
          isCompanyDraggingRef.current = false;
          companyDragStartPosRef.current = null;
        }, 100);
      }
    };
    
    companyMoveHandlerRef.current = companyMoveHandler;
    companyUpHandlerRef.current = companyUpHandler;
    
    fabricCanvas.on('mouse:move', companyMoveHandler);
    fabricCanvas.on('mouse:up', companyUpHandler);

    companyNodeRef.current = companyNode;
    fabricCanvas.add(companyNode);

    // ── Helper: wire up a contact node ──
    const contactMap = new Map<string, Contact>();
    account.contacts.forEach(c => contactMap.set(c.id, c));

    // ── Build hierarchy from manager_id (authoritative source) ──
    const parentMap = new Map<string, string>(); // child -> parent contact id
    const childrenMap = new Map<string, string[]>(); // parent -> child contact ids
    const depthMap = new Map<string, number>(); // contact id -> depth level

    // Build parent/children maps from manager_id
    account.contacts.forEach(c => {
      if (c.managerId) {
        parentMap.set(c.id, c.managerId);
        if (!childrenMap.has(c.managerId)) childrenMap.set(c.managerId, []);
        childrenMap.get(c.managerId)!.push(c.id);
      }
    });

    // ── Deterministic tree layout ──
    const treePositions = computeTreeLayout(
      account.contacts.map(c => ({ id: c.id, managerId: c.managerId || null })),
      {
        nodeWidth: NODE_W,
        nodeHeight: NODE_H,
        horizontalGap: 40,
        verticalGap: 80,
        rootY: 220,
        centerX: canvasW / 2,
      }
    );

    // Build depth map from computed positions
    const positionMap = new Map<string, TreeNodePosition>();
    for (const pos of treePositions) {
      positionMap.set(pos.contactId, pos);
      depthMap.set(pos.contactId, pos.depth);
    }

    const wireContactNode = (contact: Contact, node: Group, x: number, y: number, depth: number = 0) => {
      depthMap.set(contact.id, depth);

      // Movement handled by Carry Mode (canvas-level mouse handlers)
      // Node is selectable:false so Fabric drag events don't fire

      node.on('mouseover', function() {
        if (isCanvasDisposedRef.current) return;
        try {
          (this as FabricObject).set({ 
            shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
          });
          fabricCanvas.requestRenderAll();
        } catch {}
      });

      node.on('mouseout', function() {
        if (isCanvasDisposedRef.current) return;
        try {
          (this as FabricObject).set({ shadow: null });
          fabricCanvas.requestRenderAll();
        } catch {}
      });

      node.on('mousedown', (opt) => {
        if (isCarryingRef.current) return;
        if (interactionModeRef.current === 'edit') {
          onNodeSelectRef.current?.(contact.id);
          // Track for potential carry start
          const evt = opt.e as MouseEvent;
          carryStartPosRef.current = { x: evt.clientX, y: evt.clientY };
          carryContactPendingRef.current = contact.id;
        } else {
          onContactClickRef.current(contact);
        }
      });

      node.on('mousedblclick', () => {
        if (isCarryingRef.current) return;
        if (interactionModeRef.current === 'edit') {
          onContactClickRef.current(contact);
        } else {
          const center = node.getCenterPoint();
          fabricCanvas.setZoom(1.5);
          const vpt = fabricCanvas.viewportTransform!;
          vpt[4] = canvasW / 2 - center.x * 1.5;
          vpt[5] = fabricCanvas.height! / 2 - center.y * 1.5;
          fabricCanvas.renderAll();
        }
      });

      fabricCanvas.add(node);

      contactNodesRef.current.set(contact.id, {
        contact,
        group: node,
        anchorPoints: [
          new Point(x, y - NODE_H / 2),
          new Point(x - NODE_W / 2, y),
          new Point(x + NODE_W / 2, y),
          new Point(x, y + NODE_H / 2),
        ],
        originalPosition: { x, y },
      });
    };

    // ── Animation helpers ──
    const animateFadeOut = (canvas: FabricCanvas, line: Line, duration: number = 150): Promise<void> => {
      return new Promise(resolve => {
        if (isCanvasDisposedRef.current) { resolve(); return; }
        const steps = Math.max(1, Math.round(duration / 16));
        let step = 0;
        const initialOpacity = line.opacity ?? 1;
        const startX2 = line.x2!;
        const startY2 = line.y2!;
        const endX2 = line.x1!;
        const endY2 = line.y1!;
        const tick = () => {
          if (isCanvasDisposedRef.current) { resolve(); return; }
          step++;
          const t = step / steps;
          try {
            line.set({
              opacity: initialOpacity * (1 - t),
              x2: startX2 + (endX2 - startX2) * t,
              y2: startY2 + (endY2 - startY2) * t,
            });
            line.setCoords();
            canvas.requestRenderAll();
          } catch {}
          if (step < steps) {
            requestAnimationFrame(tick);
          } else {
            try { canvas.remove(line); } catch {}
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    };

    const animateDrawIn = (canvas: FabricCanvas, line: Line, duration: number = 200) => {
      if (isCanvasDisposedRef.current) return;
      const targetX2 = line.x2!;
      const targetY2 = line.y2!;
      const startX = line.x1!;
      const startY = line.y1!;
      line.set({ x2: startX, y2: startY, opacity: 0 });
      line.setCoords();
      const steps = Math.max(1, Math.round(duration / 16));
      let step = 0;
      const tick = () => {
        if (isCanvasDisposedRef.current) return;
        step++;
        const t = step / steps;
        const eased = 1 - (1 - t) * (1 - t);
        try {
          line.set({
            x2: startX + (targetX2 - startX) * eased,
            y2: startY + (targetY2 - startY) * eased,
            opacity: eased,
          });
          line.setCoords();
          canvas.requestRenderAll();
        } catch {}
        if (step < steps) requestAnimationFrame(tick);
        else {
          try { line.set({ opacity: 1 }); canvas.requestRenderAll(); } catch {}
        }
      };
      requestAnimationFrame(tick);
    };

    const pulseNode = (canvas: FabricCanvas, group: Group) => {
      if (isCanvasDisposedRef.current) return;
      const steps = 20;
      let step = 0;
      const tick = () => {
        if (isCanvasDisposedRef.current) return;
        step++;
        const t = step / steps;
        const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
        try {
          group.set({
            shadow: { color: 'hsl(221 83% 53%)', blur: 10 + intensity * 20, offsetX: 0, offsetY: 0 },
          });
          canvas.requestRenderAll();
        } catch {}
        if (step < steps) requestAnimationFrame(tick);
        else {
          try { group.set({ shadow: null }); canvas.requestRenderAll(); } catch {}
        }
      };
      requestAnimationFrame(tick);
    };

    // ── Ephemeral edge rebuild using orthogonal connectors ──
    // Always rebuild edges instantly — animated rebuilds with setTimeout cause race conditions and freezes
    const rebuildAllEdges = (canvas: FabricCanvas, cw: number, _animated: boolean = false) => {
      const oldLines = [...hierarchyLinesRef.current];
      hierarchyLinesRef.current = [];
      oldLines.forEach(line => { try { canvas.remove(line); } catch {} });
      drawFreshEdges(canvas, cw, false);
    };

    const drawFreshEdges = (canvas: FabricCanvas, cw: number, animated: boolean) => {
      contactNodesRef.current.forEach((childData, childId) => {
        const contact = childData.contact;
        const childCenter = childData.group.getCenterPoint();
        const depth = depthMap.get(childId) || 1;
        const lightness = Math.min(70 + depth * 3, 85);
        const strokeColor = `hsl(214 32% ${lightness}%)`;
        const baseStrokeWidth = depth === 0 ? 3 : 2;

        if (contact.managerId && contactNodesRef.current.has(contact.managerId)) {
          const parentData = contactNodesRef.current.get(contact.managerId)!;
          const parentCenter = parentData.group.getCenterPoint();

          // Orthogonal connector: down from parent, horizontal, down to child
          const parentBottomY = parentCenter.y + NODE_H / 2;
          const childTopY = childCenter.y - NODE_H / 2;
          const midY = parentBottomY + (childTopY - parentBottomY) / 2;

          // Segment 1: parent bottom → midY
          const seg1 = new Line([parentCenter.x, parentBottomY, parentCenter.x, midY], {
            stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false,
          });
          // Segment 2: horizontal at midY
          const seg2 = new Line([parentCenter.x, midY, childCenter.x, midY], {
            stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false,
          });
          // Segment 3: midY → child top
          const seg3 = new Line([childCenter.x, midY, childCenter.x, childTopY], {
            stroke: strokeColor, strokeWidth: baseStrokeWidth, selectable: false, evented: false,
          });

          [seg1, seg2, seg3].forEach(seg => {
            canvas.add(seg);
            canvas.sendObjectToBack(seg);
            hierarchyLinesRef.current.push(seg);
            if (animated) animateDrawIn(canvas, seg, 200);
          });
        } else if (!contact.managerId) {
          // Root contact → company icon connector
          const companyBottomY = 120;
          const childTopY = childCenter.y - NODE_H / 2;
          const midY = companyBottomY + (childTopY - companyBottomY) / 2;

          const seg1 = new Line([cw / 2, companyBottomY, cw / 2, midY], {
            stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false,
          });
          const seg2 = new Line([cw / 2, midY, childCenter.x, midY], {
            stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false,
          });
          const seg3 = new Line([childCenter.x, midY, childCenter.x, childTopY], {
            stroke: strokeColor, strokeWidth: 3, selectable: false, evented: false,
          });

          [seg1, seg2, seg3].forEach(seg => {
            canvas.add(seg);
            canvas.sendObjectToBack(seg);
            hierarchyLinesRef.current.push(seg);
            if (animated) animateDrawIn(canvas, seg, 200);
          });
        }
      });
    };

    // ── Place nodes using deterministic tree layout ──
    for (const pos of treePositions) {
      const contact = contactMap.get(pos.contactId);
      if (!contact) continue;
      const node = createContactNode(contact, pos.x, pos.y);
      wireContactNode(contact, node, pos.x, pos.y, pos.depth);
    }

    // ── Draw initial edges (ephemeral) ──
    rebuildAllEdges(fabricCanvas, canvasW);

    fabricCanvas.renderAll();
  }, [fabricCanvas, account]);

  // Effect: highlight selected node and its edges in edit mode
  useEffect(() => {
    if (!fabricCanvas) return;

    contactNodesRef.current.forEach((nodeData, id) => {
      const { group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;

      if (interactionMode === "edit" && selectedNodeId === id) {
        cardBg.set({ stroke: "hsl(221 83% 53%)", strokeWidth: 3 });
        group.set({ opacity: 1 });
      } else if (interactionMode === "edit" && selectedNodeId) {
        cardBg.set({ stroke: "hsl(214 32% 91%)", strokeWidth: 1 });
        group.set({ opacity: 0.9 });
      } else {
        cardBg.set({ stroke: "hsl(214 32% 91%)", strokeWidth: 1 });
        group.set({ opacity: 1 });
      }
    });

    // Style hierarchy lines based on selection
    hierarchyLinesRef.current.forEach(l => {
      if (interactionMode === "edit" && selectedNodeId) {
        l.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 });
      } else {
        // restore default depth-based styling by rebuilding
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, interactionMode, selectedNodeId]);

  // Effect to render/remove talent overlay nodes
  useEffect(() => {
    if (!fabricCanvas) return;

    // Remove existing talent nodes
    talentNodesRef.current.forEach(({ group }) => {
      fabricCanvas.remove(group);
    });
    talentNodesRef.current.clear();

    if (!showTalentOverlay || talentEngagements.length === 0) {
      fabricCanvas.renderAll();
      return;
    }

    // Group engagements by department to position them near relevant contacts
    const engagementsByDept = new Map<string, TalentEngagementWithData[]>();
    talentEngagements.forEach((eng) => {
      const dept = eng.department || "Other";
      if (!engagementsByDept.has(dept)) {
        engagementsByDept.set(dept, []);
      }
      engagementsByDept.get(dept)!.push(eng);
    });

    // Find department positions from existing contact nodes
    const deptPositions = new Map<string, { x: number; y: number; count: number }>();
    contactNodesRef.current.forEach(({ contact, group }) => {
      const dept = contact.department;
      if (!deptPositions.has(dept)) {
        deptPositions.set(dept, { x: group.left!, y: group.top!, count: 1 });
      } else {
        const pos = deptPositions.get(dept)!;
        pos.x = (pos.x * pos.count + group.left!) / (pos.count + 1);
        pos.y = Math.max(pos.y, group.top!);
        pos.count++;
      }
    });

    // Create talent nodes positioned near their department
    let talentIndex = 0;
    engagementsByDept.forEach((engagements, dept) => {
      const deptPos = deptPositions.get(dept);
      const baseX = deptPos ? deptPos.x + 220 : 800 + talentIndex * 200;
      const baseY = deptPos ? deptPos.y : 400;

      engagements.forEach((eng, idx) => {
        const x = baseX;
        const y = baseY + idx * 100;
        
        const talentNode = createTalentNode(eng, x, y);
        
        // Add hover effects
        talentNode.on('mouseover', function() {
          fabricCanvas.setCursor('pointer');
          (this as FabricObject).set({ 
            shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
          });
          fabricCanvas.renderAll();
        });

        talentNode.on('mouseout', function() {
          fabricCanvas.setCursor('default');
          (this as FabricObject).set({ shadow: null });
          fabricCanvas.renderAll();
        });

        // Click handler to open talent profile
        talentNode.on('mousedown', () => {
          if (onTalentClick) {
            onTalentClick(eng.talent, eng);
          }
        });
        
        fabricCanvas.add(talentNode);
        
        talentNodesRef.current.set(eng.id, {
          engagement: eng,
          group: talentNode,
        });
        
        talentIndex++;
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, showTalentOverlay, talentEngagements, onTalentClick]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentMatchIndex(0);

    if (!query.trim() || !fabricCanvas) {
      // Clear all highlights
    contactNodesRef.current.forEach(({ group, originalStroke, originalStrokeWidth }) => {
      const cardBg = group.getObjects()[0] as Rect;
      if (originalStroke !== undefined) {
        cardBg.set({ 
          stroke: originalStroke as string | undefined, 
          strokeWidth: originalStrokeWidth || 1 
        });
      } else {
        cardBg.set({ stroke: "hsl(214 32% 91%)", strokeWidth: 1 });
      }
    });
      setMatchedNodes([]);
      fabricCanvas.renderAll();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches: ContactNodeData[] = [];

    contactNodesRef.current.forEach((nodeData) => {
      const { contact, group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;

      // Store original stroke if not already stored
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof cardBg.stroke === 'string' ? cardBg.stroke : null;
        nodeData.originalStrokeWidth = cardBg.strokeWidth;
      }

      const isMatch =
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.title.toLowerCase().includes(lowerQuery) ||
        contact.department.toLowerCase().includes(lowerQuery) ||
        contact.status.toLowerCase().includes(lowerQuery);

      if (isMatch) {
        matches.push(nodeData);
        cardBg.set({
          stroke: "hsl(221 83% 53%)",
          strokeWidth: 3,
        });
      } else {
        // Reset to original
        cardBg.set({
          stroke: nodeData.originalStroke as string | undefined,
          strokeWidth: nodeData.originalStrokeWidth || 1,
        });
      }
    });

    setMatchedNodes(matches);

    if (matches.length > 0) {
      zoomToNode(matches[0].group);
    }

    fabricCanvas.renderAll();
  };

  const zoomToNode = (group: Group) => {
    if (!fabricCanvas) return;

    const center = group.getCenterPoint();
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    fabricCanvas.setZoom(1.5);

    const vpt = fabricCanvas.viewportTransform!;
    vpt[4] = fabricCanvas.width! / 2 - center.x * 1.5;
    vpt[5] = fabricCanvas.height! / 2 - center.y * 1.5;

    fabricCanvas.renderAll();
  };

  const handleNextMatch = () => {
    if (matchedNodes.length === 0) return;
    const newIndex = (currentMatchIndex + 1) % matchedNodes.length;
    setCurrentMatchIndex(newIndex);
    zoomToNode(matchedNodes[newIndex].group);
  };

  const handlePrevMatch = () => {
    if (matchedNodes.length === 0) return;
    const newIndex = (currentMatchIndex - 1 + matchedNodes.length) % matchedNodes.length;
    setCurrentMatchIndex(newIndex);
    zoomToNode(matchedNodes[newIndex].group);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setMatchedNodes([]);
    setCurrentMatchIndex(0);

    if (!fabricCanvas) return;

    // Reset zoom
    fabricCanvas.setZoom(1);
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];

    // Clear highlights
    contactNodesRef.current.forEach(({ group, originalStroke, originalStrokeWidth }) => {
      const cardBg = group.getObjects()[0] as Rect;
      if (originalStroke !== undefined) {
        cardBg.set({ 
          stroke: originalStroke as string | undefined, 
          strokeWidth: originalStrokeWidth || 1 
        });
      } else {
        cardBg.set({ stroke: "hsl(214 32% 91%)", strokeWidth: 1 });
      }
    });

    fabricCanvas.renderAll();
  };

  // Function to highlight specific contacts by ID (for AI knowledge panel)
  const highlightContactsById = (contactIds: string[]) => {
    if (!fabricCanvas) return;

    contactNodesRef.current.forEach((nodeData, id) => {
      const { group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;

      // Store original stroke if not already stored
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof cardBg.stroke === 'string' ? cardBg.stroke : null;
        nodeData.originalStrokeWidth = cardBg.strokeWidth;
      }

      if (contactIds.includes(id)) {
        // Highlight with a distinct gold/yellow color for AI highlights
        cardBg.set({
          stroke: "hsl(45 93% 47%)", // Gold color
          strokeWidth: 4,
        });
        // Add pulsing shadow effect
        group.set({
          shadow: { color: 'hsl(45 93% 47%)', blur: 15, offsetX: 0, offsetY: 0 }
        });
      } else {
        // Reset to original
        cardBg.set({
          stroke: nodeData.originalStroke as string | undefined,
          strokeWidth: nodeData.originalStrokeWidth || 1,
        });
        group.set({ shadow: null });
      }
    });

    fabricCanvas.renderAll();

    // If there are highlighted contacts, zoom to show them all
    if (contactIds.length > 0) {
      const highlightedNodes = contactIds
        .map(id => contactNodesRef.current.get(id))
        .filter(Boolean);

      if (highlightedNodes.length === 1) {
        zoomToNode(highlightedNodes[0]!.group);
      } else if (highlightedNodes.length > 1) {
        // Calculate bounding box of all highlighted nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        highlightedNodes.forEach(node => {
          if (node) {
            const bounds = node.group.getBoundingRect();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.left + bounds.width);
            maxY = Math.max(maxY, bounds.top + bounds.height);
          }
        });

        const padding = 100;
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const canvasWidth = fabricCanvas.width!;
        const canvasHeight = fabricCanvas.height!;
        const targetZoom = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight, 1.2);

        fabricCanvas.setZoom(targetZoom);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = canvasWidth / 2 - contentCenterX * targetZoom;
        vpt[5] = canvasHeight / 2 - contentCenterY * targetZoom;
        fabricCanvas.renderAll();
      }
    }
  };

  // Expose clearSearch and highlightContacts to parent via ref
  useImperativeHandle(ref, () => ({
    clearSearch: handleClearSearch,
    highlightContacts: highlightContactsById,
    getNodeScreenPosition: (contactId: string) => {
      const nodeData = contactNodesRef.current.get(contactId);
      if (!nodeData || !fabricCanvas || !containerRef.current) return null;
      const center = nodeData.group.getCenterPoint();
      const zoom = fabricCanvas.getZoom();
      const vpt = fabricCanvas.viewportTransform!;
      const containerRect = containerRef.current.getBoundingClientRect();
      return {
        x: center.x * zoom + vpt[4] + containerRect.left,
        y: (center.y - 45) * zoom + vpt[5] + containerRect.top, // top of node
      };
    },
  }));

  const handleResetPositions = () => {
    if (!fabricCanvas) return;

    // Calculate the bounding box of all content (current positions, not original)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Include company node
    if (companyNodeRef.current) {
      const companyBounds = companyNodeRef.current.getBoundingRect();
      minX = Math.min(minX, companyBounds.left);
      minY = Math.min(minY, companyBounds.top);
      maxX = Math.max(maxX, companyBounds.left + companyBounds.width);
      maxY = Math.max(maxY, companyBounds.top + companyBounds.height);
    }
    
    // Include all contact nodes
    contactNodesRef.current.forEach(({ group }) => {
      const bounds = group.getBoundingRect();
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.left + bounds.width);
      maxY = Math.max(maxY, bounds.top + bounds.height);
    });

    // If no content, reset to default
    if (minX === Infinity) {
      fabricCanvas.setZoom(1);
      fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
      fabricCanvas.renderAll();
      return;
    }

    // Add padding around content
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Calculate zoom to fit content in viewport
    const canvasWidth = fabricCanvas.width!;
    const canvasHeight = fabricCanvas.height!;
    const zoomX = canvasWidth / contentWidth;
    const zoomY = canvasHeight / contentHeight;
    const targetZoom = Math.min(zoomX, zoomY, 1); // Don't zoom in more than 1x

    // Calculate target viewport position to center content
    const targetVptX = canvasWidth / 2 - contentCenterX * targetZoom;
    const targetVptY = canvasHeight / 2 - contentCenterY * targetZoom;

    // Animate to the target state
    const currentZoom = fabricCanvas.getZoom();
    const currentVpt = [...fabricCanvas.viewportTransform!];
    
    const zoomSteps = 20;
    const zoomIncrement = (targetZoom - currentZoom) / zoomSteps;
    const vptXIncrement = (targetVptX - currentVpt[4]) / zoomSteps;
    const vptYIncrement = (targetVptY - currentVpt[5]) / zoomSteps;
    
    let step = 0;
    const animateZoom = () => {
      if (step < zoomSteps) {
        step++;
        fabricCanvas.setZoom(currentZoom + zoomIncrement * step);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = currentVpt[4] + vptXIncrement * step;
        vpt[5] = currentVpt[5] + vptYIncrement * step;
        fabricCanvas.renderAll();
        requestAnimationFrame(animateZoom);
      } else {
        fabricCanvas.setZoom(targetZoom);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = targetVptX;
        vpt[5] = targetVptY;
        fabricCanvas.renderAll();
      }
    };
    animateZoom();
  };

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <CanvasSearch
        onSearch={handleSearch}
        onClear={handleClearSearch}
        matchCount={matchedNodes.length}
        currentMatchIndex={currentMatchIndex}
        onNextMatch={handleNextMatch}
        onPrevMatch={handlePrevMatch}
        onReset={handleResetPositions}
        workspaceId={account.id}
        userId="current-user"
      />
      <canvas ref={canvasRef} className="w-full h-full block" />
      <CanvasMinimap mainCanvas={fabricCanvas} />
      
      {/* Company Info Popover */}
      {showCompanyHover && companyNodeRef.current && (
        <CompanyInfoPopover 
          account={account}
          position={{
            x: companyNodeRef.current.left! + 100,
            y: companyNodeRef.current.top! - 50,
          }}
          onNewsClick={() => console.log('Open news panel')}
          onNoteClick={() => console.log('Open notes panel')}
        />
      )}
    </div>
  );
});

AccountCanvas.displayName = "AccountCanvas";

const createCompanyNode = (name: string, x: number, y: number): Group => {
  // Building icon using rectangles
  const buildingMain = new Rect({
    width: 50,
    height: 60,
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
  });

  const buildingTop = new Rect({
    width: 30,
    height: 15,
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
    top: -30,
  });

  // Windows
  const windows: Rect[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const window = new Rect({
        width: 6,
        height: 8,
        fill: "white",
        opacity: 0.7,
        left: -15 + col * 10,
        top: -20 + row * 12,
        originX: "center",
        originY: "center",
      });
      windows.push(window);
    }
  }

  const text = new Text(name.toUpperCase(), {
    fontSize: 14,
    fontWeight: "bold",
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
    top: -55,
  });

  const group = new Group([buildingMain, buildingTop, ...windows, text], {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    selectable: false,
    hasControls: false,
    hasBorders: false,
  });

  return group;
};

const createContactNode = (contact: Contact, x: number, y: number): Group => {
  const statusColors: Record<string, string> = {
    champion: "hsl(142 71% 45%)",
    engaged: "hsl(142 71% 45%)",
    warm: "hsl(38 92% 50%)",
    new: "hsl(221 83% 53%)",
    blocker: "hsl(0 84% 60%)",
    unknown: "hsl(210 20% 90%)",
  };

  const bgColor = statusColors[contact.status] || statusColors.unknown;

  // Card background
  const cardBg = new Rect({
    width: 180,
    height: 90,
    fill: "white",
    stroke: "hsl(214 32% 91%)",
    strokeWidth: 1,
    rx: 8,
    ry: 8,
    left: -90,
    top: -45,
  });

  // Profile circle
  const profileCircle = new Circle({
    radius: 25,
    fill: "hsl(210 20% 90%)",
    left: -75,
    top: -20,
  });

  // Silhouette icon
  const isMale = Math.random() > 0.5;
  const silhouetteText = new Text(isMale ? "👤" : "👤", {
    fontSize: 24,
    fill: "hsl(215 16% 47%)",
    left: -75,
    top: -20,
    originX: "center",
    originY: "center",
  });

  // Name text
  const nameText = new Text(contact.name, {
    fontSize: 11,
    fontWeight: "600",
    fill: "hsl(222 47% 11%)",
    left: -40,
    top: -25,
    width: 110,
  });

  // Title text
  const titleText = new Text(contact.title, {
    fontSize: 9,
    fill: "hsl(215 16% 47%)",
    left: -40,
    top: -8,
    width: 110,
  });

  // Department text
  const deptText = new Text(contact.department, {
    fontSize: 8,
    fill: "hsl(215 16% 47%)",
    left: -40,
    top: 8,
    width: 110,
  });

  // Status indicator (small colored circle)
  const statusIndicator = new Circle({
    radius: 5,
    fill: bgColor,
    left: 65,
    top: -35,
  });

  // Magnetic anchor points
  const anchorTop = new Circle({
    radius: 4,
    fill: "hsl(221 83% 53%)",
    top: -50,
    opacity: 0,
  });

  const anchorBottom = new Circle({
    radius: 4,
    fill: "hsl(221 83% 53%)",
    top: 50,
    opacity: 0,
  });

  const group = new Group([
    cardBg,
    profileCircle,
    silhouetteText,
    nameText,
    titleText,
    deptText,
    statusIndicator,
    anchorTop,
    anchorBottom
  ], {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: true,
    hasControls: false,
    hasBorders: false,
  });

  return group;
};

const createTalentNode = (engagement: TalentEngagementWithData, x: number, y: number): Group => {
  const statusColors: Record<EngagementStatus, { bg: string; border: string; text: string }> = {
    proposed: { 
      bg: "hsl(45 93% 95%)", 
      border: "hsl(45 93% 47%)", 
      text: "Proposed" 
    },
    interviewing: { 
      bg: "hsl(221 83% 95%)", 
      border: "hsl(221 83% 53%)", 
      text: "Interviewing" 
    },
    deployed: { 
      bg: "hsl(142 71% 95%)", 
      border: "hsl(142 71% 45%)", 
      text: "Deployed" 
    },
  };

  const colors = statusColors[engagement.status];
  const talent = engagement.talent;

  // Card background with dashed border
  const cardBg = new Rect({
    width: 180,
    height: 90,
    fill: colors.bg,
    stroke: colors.border,
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    rx: 8,
    ry: 8,
    left: -90,
    top: -45,
  });

  // Talent badge indicator
  const badgeBg = new Rect({
    width: 60,
    height: 18,
    fill: colors.border,
    rx: 9,
    ry: 9,
    left: -30,
    top: -55,
  });

  const badgeText = new Text("TALENT", {
    fontSize: 9,
    fontWeight: "bold",
    fill: "white",
    originX: "center",
    originY: "center",
    left: 0,
    top: -46,
  });

  // Profile circle
  const profileCircle = new Circle({
    radius: 20,
    fill: colors.border,
    opacity: 0.3,
    left: -75,
    top: -15,
  });

  // User icon placeholder
  const silhouetteText = new Text("👤", {
    fontSize: 18,
    fill: colors.border,
    left: -75,
    top: -15,
    originX: "center",
    originY: "center",
  });

  // Name text
  const nameText = new Text(talent.name, {
    fontSize: 11,
    fontWeight: "600",
    fill: "hsl(222 47% 11%)",
    left: -45,
    top: -20,
    width: 110,
  });

  // Role type text
  const roleText = new Text(engagement.roleType, {
    fontSize: 9,
    fill: "hsl(215 16% 47%)",
    left: -45,
    top: -3,
    width: 110,
  });

  // Status text
  const statusText = new Text(colors.text, {
    fontSize: 8,
    fontWeight: "600",
    fill: colors.border,
    left: -45,
    top: 12,
    width: 110,
  });

  // Rate if available
  const rateText = talent.rate ? new Text(talent.rate, {
    fontSize: 8,
    fill: "hsl(142 71% 35%)",
    left: 55,
    top: 25,
  }) : null;

  const elements = [
    cardBg,
    badgeBg,
    badgeText,
    profileCircle,
    silhouetteText,
    nameText,
    roleText,
    statusText,
    ...(rateText ? [rateText] : []),
  ];

  const group = new Group(elements, {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    selectable: false,
    hasControls: false,
    hasBorders: false,
  });

  return group;
};
