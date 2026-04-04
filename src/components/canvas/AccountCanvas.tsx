import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { computeTreeLayout, TreeNodePosition } from "@/lib/tree-layout";
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
  
  // ── Interaction mode refs (always current inside canvas event handlers) ──
  const interactionModeRef = useRef(interactionMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onContactClickRef = useRef(onContactClick);
  
  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);

  // ── Canvas lifecycle ──
  const isCanvasDisposedRef = useRef(false);
  const hierarchyLinesRef = useRef<Line[]>([]);
  const prevContactsRef = useRef<string>("");
  const isAnimatingLayoutRef = useRef(false);

  // ── Pan state — use ref so it never goes stale across account re-renders ──
  const isPanningRef = useRef(false);
  const panLastPosRef = useRef({ x: 0, y: 0 });

  // ── Drag mode state machine: IDLE → DRAGGING → COMMITTING → IDLE ──
  const dragModeRef = useRef<"IDLE" | "DRAGGING" | "COMMITTING">("IDLE");

  // ── RAF throttling ──
  const wheelRafRef = useRef<number | null>(null);
  const guideRafRef = useRef<number | null>(null);

  // ── Snap / guide system ──
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

  // ── Company node refs (pan behaviour) ──
  const companyNodeRef = useRef<Group | null>(null);
  const companyHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompanyDraggingRef = useRef(false);
  const companyDragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const HOVER_DELAY = 700;
  const DRAG_THRESHOLD = 5;
  const AUTO_PAN_EDGE = 60;
  const AUTO_PAN_SPEED = 8;
  const COMPANY_SNAP_RADIUS = 70;
  const ZONE_DETECT_RADIUS = 180;
  const TOP_ROW_SNAP_Y_THRESHOLD = 90;

  // ── Safety reset on mode switch ──
  useEffect(() => {
    if (interactionMode !== 'edit') {
      carryContactPendingRef.current = null;
      carryStartPosRef.current = null;
      if (isCarryingRef.current) {
        isCarryingRef.current = false;
        carriedContactIdRef.current = null;
        snapResultRef.current = null;
        spacebarPanRef.current = false;
        if (ghostNodeRef.current && fabricCanvas) {
          try { fabricCanvas.remove(ghostNodeRef.current); } catch {}
          ghostNodeRef.current = null;
        }
        if (dragModeRef.current !== "COMMITTING") {
          dragModeRef.current = "IDLE";
        }
      }
    }
  }, [interactionMode, fabricCanvas]);

  // ── Guide helpers ──
  const clearGuideLines = useCallback((canvas: FabricCanvas) => {
    guideLinesToRef.current.forEach(obj => { try { canvas.remove(obj); } catch {} });
    guideLinesToRef.current = [];
    snapResultRef.current = null;
  }, []);

  const addGuideRect = useCallback((canvas: FabricCanvas, left: number, top: number, width: number, height: number, color: string, opacity = 0.3) => {
    const rect = new Rect({ left, top, width, height, fill: color, opacity, selectable: false, evented: false, rx: 4, ry: 4 });
    canvas.add(rect);
    guideLinesToRef.current.push(rect);
    return rect;
  }, []);

  const addGuideLine = useCallback((canvas: FabricCanvas, x1: number, y1: number, x2: number, y2: number, color = "hsl(221 83% 53%)") => {
    const line = new Line([x1, y1, x2, y2], { stroke: color, strokeWidth: 2, strokeDashArray: [6, 4], selectable: false, evented: false, opacity: 0.7 });
    canvas.add(line);
    guideLinesToRef.current.push(line);
  }, []);

  // ── Cycle detection ──
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

  // ── Zone detection ──
  const NODE_HEIGHT = 90;
  const detectZone = useCallback((dragX: number, dragY: number, targetX: number, targetY: number): DropZone | null => {
    const dx = dragX - targetX;
    const dy = dragY - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > ZONE_DETECT_RADIUS) return null;

    // If the dragged node is within the vertical band of the target node
    // (roughly same Y level), ALWAYS treat as sibling — never as child.
    // This ensures dragging beside a contact puts them on the same reporting line.
    const ySiblingThreshold = NODE_HEIGHT * 0.75; // 67px tolerance
    if (Math.abs(dy) < ySiblingThreshold) {
      return dx < 0 ? "left" : "right";
    }

    // Only treat as "child" when clearly dragged below the target
    if (dy > 0) return "bottom";

    // Above the target — treat as sibling
    return dx < 0 ? "left" : "right";
  }, []);

  // ── Auto-pan ──
  const stopAutoPan = useCallback(() => {
    if (autoPanIntervalRef.current) {
      clearInterval(autoPanIntervalRef.current);
      autoPanIntervalRef.current = null;
    }
  }, []);

  const startAutoPan = useCallback((canvas: FabricCanvas, mouseX: number, mouseY: number) => {
    const cw = canvas.width!;
    const ch = canvas.height!;
    let dx = 0, dy = 0;
    if (mouseX < AUTO_PAN_EDGE) dx = AUTO_PAN_SPEED;
    else if (mouseX > cw - AUTO_PAN_EDGE) dx = -AUTO_PAN_SPEED;
    if (mouseY < AUTO_PAN_EDGE) dy = AUTO_PAN_SPEED;
    else if (mouseY > ch - AUTO_PAN_EDGE) dy = -AUTO_PAN_SPEED;
    if (dx === 0 && dy === 0) { stopAutoPan(); return; }
    if (autoPanIntervalRef.current) return;
    autoPanIntervalRef.current = setInterval(() => {
      if (isCanvasDisposedRef.current || !isCarryingRef.current) { stopAutoPan(); return; }
      try {
        const vpt = canvas.viewportTransform!;
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.requestRenderAll();
      } catch { stopAutoPan(); }
    }, 32);
  }, [stopAutoPan]);

  // ── Carry Mode: startCarry ──
  const startCarryRef = useRef<(canvas: FabricCanvas, contactId: string) => void>(() => {});
  const endCarryRef = useRef<(canvas: FabricCanvas, forceRevert?: boolean) => Promise<void>>(async () => {});
  const computeCarrySnapsRef = useRef<(canvas: FabricCanvas) => void>(() => {});

  const startCarry = useCallback((canvas: FabricCanvas, contactId: string) => {
    // Guard: never start carry while already carrying or committing
    if (isCarryingRef.current || dragModeRef.current !== "IDLE") return;
    const nodeData = contactNodesRef.current.get(contactId);
    if (!nodeData) return;

    isCarryingRef.current = true;
    carriedContactIdRef.current = contactId;
    dragModeRef.current = "DRAGGING";

    // Dim the original node
    nodeData.group.set({ opacity: 0.3 });
    const cardBg = nodeData.group.getObjects()[0] as Rect;
    cardBg.set({ strokeDashArray: [6, 4], stroke: 'hsl(214 32% 70%)', strokeWidth: 2 });
    hierarchyLinesRef.current.forEach(l => l.set({ opacity: 0.2 }));

    // Create ghost
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
  useEffect(() => { startCarryRef.current = startCarry; }, [startCarry]);

  const endCarry = useCallback(async (canvas: FabricCanvas, forceRevert: boolean = false) => {
    if (!isCarryingRef.current) return;
    stopAutoPan();
    if (guideRafRef.current !== null) { cancelAnimationFrame(guideRafRef.current); guideRafRef.current = null; }

    // Capture BEFORE clearGuideLines resets snapResultRef
    const carriedId = carriedContactIdRef.current;
    const result = forceRevert ? null : snapResultRef.current;

    clearGuideLines(canvas);

    // Reset carry state immediately to unblock future drags
    isCarryingRef.current = false;
    carriedContactIdRef.current = null;
    carryContactPendingRef.current = null;
    carryStartPosRef.current = null;
    snapResultRef.current = null;
    spacebarPanRef.current = false;
    // Also unblock pan state in case it got stuck during carry
    isPanningRef.current = false;

    const restoreNodeVisual = (id: string | null) => {
      if (!id) return;
      const nodeData = contactNodesRef.current.get(id);
      if (nodeData) {
        try {
          nodeData.group.set({ opacity: 1 });
          const cardBg = nodeData.group.getObjects()[0] as Rect;
          cardBg.set({ strokeDashArray: undefined as any, stroke: 'hsl(214 32% 91%)', strokeWidth: 1 });
        } catch {}
      }
    };

    const removeGhost = () => {
      if (ghostNodeRef.current) {
        try { canvas.remove(ghostNodeRef.current); } catch {}
        ghostNodeRef.current = null;
      }
    };

    const restoreConnectors = () => {
      hierarchyLinesRef.current.forEach(l => { try { l.set({ opacity: 1 }); } catch {} });
    };

    if (result && carriedId) {
      dragModeRef.current = "COMMITTING";
      hierarchyLinesRef.current.forEach(l => { try { l.set({ opacity: 0.15 }); } catch {} });
      try {
        await onStructuralDropRef.current?.(carriedId, result.targetId, result.zone);
      } catch (err) {
        console.error("Structural drop failed:", err);
      } finally {
        // ALWAYS reset to IDLE — even on network error
        removeGhost();
        restoreNodeVisual(carriedId);
        restoreConnectors();
        dragModeRef.current = "IDLE";
        try { canvas.requestRenderAll(); } catch {}
      }
    } else {
      removeGhost();
      restoreNodeVisual(carriedId);
      restoreConnectors();
      dragModeRef.current = "IDLE";
      try { canvas.requestRenderAll(); } catch {}
    }
  }, [stopAutoPan, clearGuideLines]);
  useEffect(() => { endCarryRef.current = endCarry; }, [endCarry]);

  const computeCarrySnaps = useCallback((canvas: FabricCanvas) => {
    if (!isCarryingRef.current || !ghostNodeRef.current) return;
    clearGuideLines(canvas);
    const pointer = ghostNodeRef.current.getCenterPoint();
    const dragX = pointer.x, dragY = pointer.y;
    const carriedId = carriedContactIdRef.current;
    if (!carriedId) return;
    const NODE_W = 180, NODE_H = 90;

    // Check snap to company root
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

    // Viewport-filtered contact snap
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
      const zone = detectZone(dragX, dragY, oc.x, oc.y);
      if (!zone) return;
      const dist = Math.sqrt((dragX - oc.x) ** 2 + (dragY - oc.y) ** 2);
      if (!best || dist < best.dist) best = { id: oid, zone, dist };
    });

    if (best) {
      const td = contactNodesRef.current.get(best.id)!;
      const tc = td.group.getCenterPoint();
      const hw = NODE_W / 2, hh = NODE_H / 2;
      const siblingColor = "hsl(221 83% 53%)";
      const childColor = "hsl(142 71% 45%)";
      switch (best.zone) {
        case "left":
          addGuideRect(canvas, tc.x - hw - 6, tc.y - hh, 4, NODE_H, siblingColor, 0.7);
          addGuideLine(canvas, tc.x - hw - 4, tc.y, dragX + hw, dragY, siblingColor);
          break;
        case "right":
          addGuideRect(canvas, tc.x + hw + 2, tc.y - hh, 4, NODE_H, siblingColor, 0.7);
          addGuideLine(canvas, tc.x + hw + 4, tc.y, dragX - hw, dragY, siblingColor);
          break;
        case "bottom":
          addGuideRect(canvas, tc.x - hw, tc.y + hh + 2, NODE_W, 4, childColor, 0.7);
          addGuideLine(canvas, tc.x, tc.y + hh + 4, tc.x, tc.y + hh + 30, childColor);
          break;
      }
      snapResultRef.current = { targetId: best.id, zone: best.zone };
    } else {
      // Root-row fallback: allow dropping anywhere on the top line to create
      // additional top-level siblings (critical for multi-contact senior rows).
      const rootCandidates = accountContactsRef.current
        .filter((c) => (c.managerId ?? null) === null && c.id !== carriedId)
        .map((c) => {
          const node = contactNodesRef.current.get(c.id);
          if (!node) return null;
          return { id: c.id, center: node.group.getCenterPoint() };
        })
        .filter((n): n is { id: string; center: Point } => !!n)
        .sort((a, b) => a.center.x - b.center.x);

      if (rootCandidates.length > 0) {
        const avgRootY = rootCandidates.reduce((sum, n) => sum + n.center.y, 0) / rootCandidates.length;
        const inTopRowBand = Math.abs(dragY - avgRootY) <= TOP_ROW_SNAP_Y_THRESHOLD;

        if (inTopRowBand) {
          const nearestRoot = rootCandidates.reduce((closest, current) => {
            const closestDist = Math.abs(dragX - closest.center.x);
            const currentDist = Math.abs(dragX - current.center.x);
            return currentDist < closestDist ? current : closest;
          });

          const zone: DropZone = dragX < nearestRoot.center.x ? "left" : "right";
          const tc = nearestRoot.center;
          const hw = NODE_W / 2;
          const siblingColor = "hsl(221 83% 53%)";

          if (zone === "left") {
            addGuideRect(canvas, tc.x - hw - 6, tc.y - NODE_H / 2, 4, NODE_H, siblingColor, 0.7);
            addGuideLine(canvas, tc.x - hw - 4, tc.y, dragX + hw, dragY, siblingColor);
          } else {
            addGuideRect(canvas, tc.x + hw + 2, tc.y - NODE_H / 2, 4, NODE_H, siblingColor, 0.7);
            addGuideLine(canvas, tc.x + hw + 4, tc.y, dragX - hw, dragY, siblingColor);
          }

          snapResultRef.current = { targetId: nearestRoot.id, zone };
        } else {
          snapResultRef.current = null;
        }
      } else {
        snapResultRef.current = null;
      }
    }
    canvas.requestRenderAll();
  }, [clearGuideLines, addGuideRect, addGuideLine, detectZone, isDescendant]);
  useEffect(() => { computeCarrySnapsRef.current = computeCarrySnaps; }, [computeCarrySnaps]);

  // ── Canvas initialisation (runs ONCE) ──
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    isCanvasDisposedRef.current = false;

    const container = containerRef.current;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: "hsl(210 40% 98%)",
      selection: false,
    });

    // Zoom with RAF throttle
    canvas.on('mouse:wheel', (opt) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      if (wheelRafRef.current !== null) return;
      const delta = opt.e.deltaY;
      const offsetX = opt.e.offsetX;
      const offsetY = opt.e.offsetY;
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        zoom = Math.max(0.3, Math.min(3, zoom));
        canvas.zoomToPoint(new Point(offsetX, offsetY), zoom);
      });
    });

    // ── mouse:down — carry initiation OR background pan ──
    canvas.on('mouse:down', (opt) => {
      // Block all interaction while committing
      if (dragModeRef.current === "COMMITTING") return;
      // Block new carry while already carrying
      if (isCarryingRef.current) return;

      const evt = opt.e as MouseEvent;

      if (opt.target) {
        // In edit mode: check if this is a contact node → prepare carry
        if (interactionModeRef.current === 'edit') {
          let foundContactId: string | null = null;
          contactNodesRef.current.forEach((nodeData, cId) => {
            if (foundContactId) return;
            if (nodeData.group === opt.target || nodeData.group.contains(opt.target as FabricObject)) {
              foundContactId = cId;
            }
          });
          if (foundContactId) {
            onNodeSelectRef.current?.(foundContactId);
            carryStartPosRef.current = { x: evt.clientX, y: evt.clientY };
            carryContactPendingRef.current = foundContactId;
            canvas.setCursor('move');
            return; // don't start pan
          }
        }
        // In browse mode: contact click is handled by the node's own mousedown handler
      } else {
        // Background click — start panning
        // Clear any stale pending carry first
        carryContactPendingRef.current = null;
        carryStartPosRef.current = null;
        isPanningRef.current = true;
        panLastPosRef.current = { x: evt.clientX, y: evt.clientY };
        canvas.selection = false;
        canvas.setCursor('grab');
      }
    });

    // ── mouse:move — carry ghost update OR pan ──
    canvas.on('mouse:move', (opt) => {
      const evt = opt.e as MouseEvent;

      // Check if carry should start (threshold reached)
      if (carryContactPendingRef.current && !isCarryingRef.current && carryStartPosRef.current) {
        const dx = Math.abs(evt.clientX - carryStartPosRef.current.x);
        const dy = Math.abs(evt.clientY - carryStartPosRef.current.y);
        if (dx > 5 || dy > 5) {
          startCarryRef.current(canvas, carryContactPendingRef.current);
          carryContactPendingRef.current = null;
        }
      }

      // Carry ghost follow + snap detection
      if (isCarryingRef.current && ghostNodeRef.current) {
        if (spacebarPanRef.current) {
          // Spacebar pan during carry
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.movementX;
          vpt[5] += evt.movementY;
          canvas.requestRenderAll();
          return;
        }
        const pointer = canvas.getPointer(evt);
        ghostNodeRef.current.set({ left: pointer.x, top: pointer.y });
        ghostNodeRef.current.setCoords();
        startAutoPan(canvas, evt.offsetX, evt.offsetY);
        // Throttled snap computation
        if (guideRafRef.current === null) {
          guideRafRef.current = requestAnimationFrame(() => {
            guideRafRef.current = null;
            if (isCarryingRef.current) computeCarrySnapsRef.current(canvas);
          });
        }
        canvas.requestRenderAll();
        return;
      }

      // Background pan
      if (isPanningRef.current) {
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - panLastPosRef.current.x;
        vpt[5] += evt.clientY - panLastPosRef.current.y;
        panLastPosRef.current = { x: evt.clientX, y: evt.clientY };
        canvas.requestRenderAll();
      }
    });

    // ── mouse:up — end carry OR end pan ──
    canvas.on('mouse:up', () => {
      if (isCarryingRef.current) {
        endCarryRef.current(canvas);
        return;
      }
      if (dragModeRef.current === "COMMITTING") return;

      // Cancel pending carry (was a click, not a drag)
      carryContactPendingRef.current = null;
      carryStartPosRef.current = null;
      isPanningRef.current = false;
      canvas.setViewportTransform(canvas.viewportTransform!);
      canvas.selection = false;
      canvas.setCursor('default');
    });

    setFabricCanvas(canvas);

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && !isCanvasDisposedRef.current) {
        canvas.setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
        canvas.renderAll();
      }
    };
    window.addEventListener("resize", handleResize);

    // Keyboard (Spacebar pan, Escape revert)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isCarryingRef.current) { e.preventDefault(); spacebarPanRef.current = true; canvas.setCursor('grab'); }
      if (e.code === 'Escape' && isCarryingRef.current) { endCarryRef.current(canvas, true); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spacebarPanRef.current = false; if (isCarryingRef.current) canvas.setCursor('default'); }
    };

    // CRITICAL: window-level mouseup catches releases outside the canvas element
    const handleWindowMouseUp = () => {
      if (isCarryingRef.current) {
        endCarryRef.current(canvas);
      } else {
        // Always clear pending state + pan on any release outside canvas
        carryContactPendingRef.current = null;
        carryStartPosRef.current = null;
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
      stopAutoPan();
      isCanvasDisposedRef.current = true;
      try { canvas.dispose(); } catch {}
    };
  }, []); // ← runs once only

  // ── Edge drawing helper (used by both full-rebuild and hierarchy-only update) ──
  const drawFreshEdges = useCallback((canvas: FabricCanvas, cw: number, depthMap: Map<string, number>, animated: boolean = false) => {
    const animateDrawIn = (line: Line, duration = 200) => {
      if (isCanvasDisposedRef.current) return;
      const tx2 = line.x2!, ty2 = line.y2!, sx = line.x1!, sy = line.y1!;
      line.set({ x2: sx, y2: sy, opacity: 0 });
      line.setCoords();
      const steps = Math.max(1, Math.round(duration / 16));
      let step = 0;
      const tick = () => {
        if (isCanvasDisposedRef.current) return;
        step++;
        const eased = 1 - (1 - step / steps) ** 2;
        try { line.set({ x2: sx + (tx2 - sx) * eased, y2: sy + (ty2 - sy) * eased, opacity: eased }); line.setCoords(); canvas.requestRenderAll(); } catch {}
        if (step < steps) requestAnimationFrame(tick);
        else { try { line.set({ opacity: 1 }); canvas.requestRenderAll(); } catch {} }
      };
      requestAnimationFrame(tick);
    };

    const NODE_W = 180, NODE_H = 90;
    contactNodesRef.current.forEach((childData, childId) => {
      const contact = childData.contact;
      const childCenter = childData.group.getCenterPoint();
      const depth = depthMap.get(childId) || 1;
      const lightness = Math.min(70 + depth * 3, 85);
      const strokeColor = `hsl(214 32% ${lightness}%)`;
      const sw = depth === 0 ? 3 : 2;

      const addSegs = (pairs: [number, number, number, number][], width: number) => {
        pairs.forEach(([x1, y1, x2, y2]) => {
          const seg = new Line([x1, y1, x2, y2], { stroke: strokeColor, strokeWidth: width, selectable: false, evented: false });
          canvas.add(seg);
          canvas.sendObjectToBack(seg);
          hierarchyLinesRef.current.push(seg);
          if (animated) animateDrawIn(seg, 200);
        });
      };

      if (contact.managerId && contactNodesRef.current.has(contact.managerId)) {
        const parentCenter = contactNodesRef.current.get(contact.managerId)!.group.getCenterPoint();
        const py = parentCenter.y + NODE_H / 2;
        const cy = childCenter.y - NODE_H / 2;
        const mid = py + (cy - py) / 2;
        addSegs([[parentCenter.x, py, parentCenter.x, mid], [parentCenter.x, mid, childCenter.x, mid], [childCenter.x, mid, childCenter.x, cy]], sw);
      } else if (!contact.managerId) {
        const companyBottomY = 120;
        const cy = childCenter.y - NODE_H / 2;
        const mid = companyBottomY + (cy - companyBottomY) / 2;
        addSegs([[cw / 2, companyBottomY, cw / 2, mid], [cw / 2, mid, childCenter.x, mid], [childCenter.x, mid, childCenter.x, cy]], 3);
      }
    });
  }, []);

  // ── Main render effect: rebuilds canvas when account changes ──
  useEffect(() => {
    if (!fabricCanvas || !account || isCanvasDisposedRef.current) return;
    accountContactsRef.current = account.contacts;

    const canvasW = fabricCanvas.width!;
    const NODE_W = 180, NODE_H = 90;

    // Fingerprint to detect hierarchy-only vs full-contact-set changes
    const contactFingerprint = account.contacts.map(c => `${c.id}:${c.managerId || ''}:${c.siblingOrder ?? 0}`).sort().join('|');
    const contactIdSet = account.contacts.map(c => c.id).sort().join(',');
    const prevFingerprint = prevContactsRef.current;
    const prevIdSet = prevFingerprint.split('|').map(s => s.split(':')[0]).filter(Boolean).sort().join(',');
    const isHierarchyOnlyChange = prevFingerprint !== '' && prevIdSet === contactIdSet && prevFingerprint !== contactFingerprint;
    prevContactsRef.current = contactFingerprint;

    if (isHierarchyOnlyChange && contactNodesRef.current.size > 0) {
      // ── Smooth animated re-layout (hierarchy changed, no new contacts) ──
      const treePositions = computeTreeLayout(
        account.contacts.map(c => ({ id: c.id, managerId: c.managerId || null, siblingOrder: c.siblingOrder ?? 0 })),
        { nodeWidth: NODE_W, nodeHeight: NODE_H, horizontalGap: 40, verticalGap: 80, rootY: 220, centerX: canvasW / 2 }
      );

      // Clear connectors immediately
      hierarchyLinesRef.current.forEach(l => { try { fabricCanvas.remove(l); } catch {} });
      hierarchyLinesRef.current = [];

      const depthMap = new Map<string, number>();
      const animations: { nodeData: ContactNodeData; startX: number; startY: number; endX: number; endY: number }[] = [];

      for (const pos of treePositions) {
        const nodeData = contactNodesRef.current.get(pos.contactId);
        if (!nodeData) continue;
        const currentCenter = nodeData.group.getCenterPoint();
        animations.push({ nodeData, startX: currentCenter.x, startY: currentCenter.y, endX: pos.x, endY: pos.y });
        depthMap.set(pos.contactId, pos.depth);
        const updatedContact = account.contacts.find(c => c.id === pos.contactId);
        if (updatedContact) nodeData.contact = updatedContact;
        nodeData.originalPosition = { x: pos.x, y: pos.y };
      }

      isAnimatingLayoutRef.current = true;
      const ANIM_STEPS = Math.round(250 / 16);
      let step = 0;

      const tick = () => {
        if (isCanvasDisposedRef.current) { isAnimatingLayoutRef.current = false; return; }
        step++;
        const eased = 1 - (1 - step / ANIM_STEPS) ** 2;
        for (const a of animations) {
          a.nodeData.group.set({ left: a.startX + (a.endX - a.startX) * eased, top: a.startY + (a.endY - a.startY) * eased });
          a.nodeData.group.setCoords();
        }
        fabricCanvas.requestRenderAll();
        if (step < ANIM_STEPS) {
          requestAnimationFrame(tick);
        } else {
          isAnimatingLayoutRef.current = false;
          for (const a of animations) { a.nodeData.group.set({ left: a.endX, top: a.endY }); a.nodeData.group.setCoords(); }
          hierarchyLinesRef.current.forEach(l => { try { fabricCanvas.remove(l); } catch {} });
          hierarchyLinesRef.current = [];
          drawFreshEdges(fabricCanvas, canvasW, depthMap, true);
          fabricCanvas.requestRenderAll();
        }
      };
      requestAnimationFrame(tick);
      return;
    }

    // ── Full rebuild ──
    try { fabricCanvas.clear(); } catch { return; }
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();
    hierarchyLinesRef.current = [];

    // Company node
    const companyNode = createCompanyNode(account.name, canvasW / 2, 80);

    const cancelCompanyHoverTimer = () => {
      if (companyHoverTimerRef.current) { clearTimeout(companyHoverTimerRef.current); companyHoverTimerRef.current = null; }
    };

    companyNode.on('mouseover', function() {
      if (isCompanyDraggingRef.current) return;
      (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 4 } });
      fabricCanvas.renderAll();
      cancelCompanyHoverTimer();
      companyHoverTimerRef.current = setTimeout(() => { if (!isCompanyDraggingRef.current) setShowCompanyHover(true); }, HOVER_DELAY);
    });

    companyNode.on('mouseout', function() {
      cancelCompanyHoverTimer();
      (this as FabricObject).set({ shadow: null });
      fabricCanvas.renderAll();
      setTimeout(() => setShowCompanyHover(false), 300);
    });

    // Company drag-to-pan via mousedown on the node
    companyNode.on('mousedown', function(opt: any) {
      const evt = (opt.e || opt) as MouseEvent;
      isCompanyDraggingRef.current = false;
      companyDragStartPosRef.current = { x: evt.clientX, y: evt.clientY };
      cancelCompanyHoverTimer();
      setShowCompanyHover(false);

      // Use window-level handlers for move/up so they clean up properly
      const onMove = (e: MouseEvent) => {
        if (!companyDragStartPosRef.current) return;
        const ddx = Math.abs(e.clientX - companyDragStartPosRef.current.x);
        const ddy = Math.abs(e.clientY - companyDragStartPosRef.current.y);
        if (!isCompanyDraggingRef.current && (ddx > DRAG_THRESHOLD || ddy > DRAG_THRESHOLD)) {
          isCompanyDraggingRef.current = true;
        }
        if (isCompanyDraggingRef.current) {
          const vpt = fabricCanvas.viewportTransform!;
          // Move the whole viewport (pan), not just the company node
          vpt[4] += e.movementX;
          vpt[5] += e.movementY;
          fabricCanvas.requestRenderAll();
        }
      };
      const onUp = () => {
        setTimeout(() => {
          isCompanyDraggingRef.current = false;
          companyDragStartPosRef.current = null;
        }, 100);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    companyNodeRef.current = companyNode;
    fabricCanvas.add(companyNode);

    // Build hierarchy maps
    const contactMap = new Map<string, Contact>();
    const depthMap = new Map<string, number>();
    account.contacts.forEach(c => contactMap.set(c.id, c));

    const treePositions = computeTreeLayout(
      account.contacts.map(c => ({ id: c.id, managerId: c.managerId || null, siblingOrder: c.siblingOrder ?? 0 })),
      { nodeWidth: NODE_W, nodeHeight: NODE_H, horizontalGap: 40, verticalGap: 80, rootY: 220, centerX: canvasW / 2 }
    );

    for (const pos of treePositions) {
      depthMap.set(pos.contactId, pos.depth);
    }

    // Wire up a contact node with hover + click
    const wireContactNode = (contact: Contact, node: Group, x: number, y: number, depth: number) => {
      node.on('mouseover', function() {
        if (isCanvasDisposedRef.current) return;
        try { (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 } }); fabricCanvas.requestRenderAll(); } catch {}
      });
      node.on('mouseout', function() {
        if (isCanvasDisposedRef.current) return;
        try { (this as FabricObject).set({ shadow: null }); fabricCanvas.requestRenderAll(); } catch {}
      });

      // Click: only open record in browse mode when not in any drag state
      node.on('mousedown', () => {
        if (
          interactionModeRef.current === 'browse' &&
          !isCarryingRef.current &&
          dragModeRef.current === "IDLE" &&
          !carryContactPendingRef.current
        ) {
          onContactClickRef.current(contact);
        }
        // In edit mode: canvas-level mouse:down handles carry — this handler is intentionally silent
      });

      fabricCanvas.add(node);
      contactNodesRef.current.set(contact.id, {
        contact, group: node,
        anchorPoints: [
          new Point(x, y - NODE_H / 2),
          new Point(x - NODE_W / 2, y),
          new Point(x + NODE_W / 2, y),
          new Point(x, y + NODE_H / 2),
        ],
        originalPosition: { x, y },
      });
    };

    // Place nodes
    for (const pos of treePositions) {
      const contact = contactMap.get(pos.contactId);
      if (!contact) continue;
      const node = createContactNode(contact, pos.x, pos.y);
      wireContactNode(contact, node, pos.x, pos.y, pos.depth);
    }

    // Draw edges (no animation on full rebuild for speed)
    drawFreshEdges(fabricCanvas, canvasW, depthMap, false);
    fabricCanvas.renderAll();
  }, [fabricCanvas, account, drawFreshEdges]);

  // ── Selected node highlight in edit mode ──
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
    fabricCanvas.renderAll();
  }, [fabricCanvas, interactionMode, selectedNodeId]);

  // ── Talent overlay ──
  useEffect(() => {
    if (!fabricCanvas) return;
    talentNodesRef.current.forEach(({ group }) => { fabricCanvas.remove(group); });
    talentNodesRef.current.clear();
    if (!showTalentOverlay || talentEngagements.length === 0) { fabricCanvas.renderAll(); return; }

    const engagementsByDept = new Map<string, TalentEngagementWithData[]>();
    talentEngagements.forEach(eng => {
      const dept = eng.department || "Other";
      if (!engagementsByDept.has(dept)) engagementsByDept.set(dept, []);
      engagementsByDept.get(dept)!.push(eng);
    });

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

    let talentIndex = 0;
    engagementsByDept.forEach((engagements, dept) => {
      const deptPos = deptPositions.get(dept);
      const baseX = deptPos ? deptPos.x + 220 : 800 + talentIndex * 200;
      const baseY = deptPos ? deptPos.y : 400;
      engagements.forEach((eng, idx) => {
        const talentNode = createTalentNode(eng, baseX, baseY + idx * 100);
        talentNode.on('mouseover', function() { fabricCanvas.setCursor('pointer'); (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 } }); fabricCanvas.renderAll(); });
        talentNode.on('mouseout', function() { fabricCanvas.setCursor('default'); (this as FabricObject).set({ shadow: null }); fabricCanvas.renderAll(); });
        talentNode.on('mousedown', () => { if (onTalentClick) onTalentClick(eng.talent, eng); });
        fabricCanvas.add(talentNode);
        talentNodesRef.current.set(eng.id, { engagement: eng, group: talentNode });
        talentIndex++;
      });
    });
    fabricCanvas.renderAll();
  }, [fabricCanvas, showTalentOverlay, talentEngagements, onTalentClick]);

  // ── Search ──
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentMatchIndex(0);
    if (!query.trim() || !fabricCanvas) {
      contactNodesRef.current.forEach(({ group, originalStroke, originalStrokeWidth }) => {
        const cardBg = group.getObjects()[0] as Rect;
        cardBg.set({ stroke: originalStroke !== undefined ? (originalStroke as string | undefined) : "hsl(214 32% 91%)", strokeWidth: originalStrokeWidth || 1 });
      });
      setMatchedNodes([]);
      fabricCanvas?.renderAll();
      return;
    }
    const lq = query.toLowerCase();
    const matches: ContactNodeData[] = [];
    contactNodesRef.current.forEach(nodeData => {
      const { contact, group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof cardBg.stroke === 'string' ? cardBg.stroke : null;
        nodeData.originalStrokeWidth = cardBg.strokeWidth;
      }
      const isMatch = contact.name.toLowerCase().includes(lq) || contact.title.toLowerCase().includes(lq) || contact.department.toLowerCase().includes(lq) || contact.status.toLowerCase().includes(lq);
      if (isMatch) { matches.push(nodeData); cardBg.set({ stroke: "hsl(221 83% 53%)", strokeWidth: 3 }); }
      else { cardBg.set({ stroke: nodeData.originalStroke as string | undefined, strokeWidth: nodeData.originalStrokeWidth || 1 }); }
    });
    setMatchedNodes(matches);
    if (matches.length > 0) zoomToNode(matches[0].group);
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
    if (!matchedNodes.length) return;
    const i = (currentMatchIndex + 1) % matchedNodes.length;
    setCurrentMatchIndex(i);
    zoomToNode(matchedNodes[i].group);
  };

  const handlePrevMatch = () => {
    if (!matchedNodes.length) return;
    const i = (currentMatchIndex - 1 + matchedNodes.length) % matchedNodes.length;
    setCurrentMatchIndex(i);
    zoomToNode(matchedNodes[i].group);
  };

  const handleClearSearch = () => {
    setSearchQuery(""); setMatchedNodes([]); setCurrentMatchIndex(0);
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    contactNodesRef.current.forEach(({ group, originalStroke, originalStrokeWidth }) => {
      const cardBg = group.getObjects()[0] as Rect;
      cardBg.set({ stroke: originalStroke !== undefined ? (originalStroke as string | undefined) : "hsl(214 32% 91%)", strokeWidth: originalStrokeWidth || 1 });
    });
    fabricCanvas.renderAll();
  };

  const highlightContactsById = (contactIds: string[]) => {
    if (!fabricCanvas) return;
    contactNodesRef.current.forEach((nodeData, id) => {
      const { group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof cardBg.stroke === 'string' ? cardBg.stroke : null;
        nodeData.originalStrokeWidth = cardBg.strokeWidth;
      }
      if (contactIds.includes(id)) {
        cardBg.set({ stroke: "hsl(45 93% 47%)", strokeWidth: 4 });
        group.set({ shadow: { color: 'hsl(45 93% 47%)', blur: 15, offsetX: 0, offsetY: 0 } });
      } else {
        cardBg.set({ stroke: nodeData.originalStroke as string | undefined, strokeWidth: nodeData.originalStrokeWidth || 1 });
        group.set({ shadow: null });
      }
    });
    fabricCanvas.renderAll();
    if (contactIds.length === 1) {
      const n = contactNodesRef.current.get(contactIds[0]);
      if (n) zoomToNode(n.group);
    } else if (contactIds.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      contactIds.forEach(id => {
        const n = contactNodesRef.current.get(id);
        if (n) { const b = n.group.getBoundingRect(); minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height); }
      });
      const pad = 100, cw = fabricCanvas.width!, ch = fabricCanvas.height!;
      const zoom = Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2), 1.2);
      fabricCanvas.setZoom(zoom);
      const vpt = fabricCanvas.viewportTransform!;
      vpt[4] = cw / 2 - ((minX + maxX) / 2) * zoom;
      vpt[5] = ch / 2 - ((minY + maxY) / 2) * zoom;
      fabricCanvas.renderAll();
    }
  };

  useImperativeHandle(ref, () => ({
    clearSearch: handleClearSearch,
    highlightContacts: highlightContactsById,
    getNodeScreenPosition: (contactId: string) => {
      const nodeData = contactNodesRef.current.get(contactId);
      if (!nodeData || !fabricCanvas || !containerRef.current) return null;
      const center = nodeData.group.getCenterPoint();
      const zoom = fabricCanvas.getZoom();
      const vpt = fabricCanvas.viewportTransform!;
      const rect = containerRef.current.getBoundingClientRect();
      return { x: center.x * zoom + vpt[4] + rect.left, y: (center.y - 45) * zoom + vpt[5] + rect.top };
    },
  }));

  const handleResetPositions = () => {
    if (!fabricCanvas) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (companyNodeRef.current) {
      const b = companyNodeRef.current.getBoundingRect();
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    }
    contactNodesRef.current.forEach(({ group }) => {
      const b = group.getBoundingRect();
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    });
    if (minX === Infinity) { fabricCanvas.setZoom(1); fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0]; fabricCanvas.renderAll(); return; }
    const pad = 50, cw = fabricCanvas.width!, ch = fabricCanvas.height!;
    const zoom = Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2), 1);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const curZoom = fabricCanvas.getZoom();
    const curVpt = [...fabricCanvas.viewportTransform!];
    const tvx = cw / 2 - cx * zoom, tvy = ch / 2 - cy * zoom;
    const steps = 20;
    let step = 0;
    const anim = () => {
      if (step++ < steps) {
        const t = step / steps;
        fabricCanvas.setZoom(curZoom + (zoom - curZoom) * t);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = curVpt[4] + (tvx - curVpt[4]) * t;
        vpt[5] = curVpt[5] + (tvy - curVpt[5]) * t;
        fabricCanvas.renderAll();
        requestAnimationFrame(anim);
      } else {
        fabricCanvas.setZoom(zoom);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = tvx; vpt[5] = tvy;
        fabricCanvas.renderAll();
      }
    };
    anim();
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
      {showCompanyHover && companyNodeRef.current && (
        <CompanyInfoPopover
          account={account}
          position={{ x: companyNodeRef.current.left! + 100, y: companyNodeRef.current.top! - 50 }}
          onNewsClick={() => console.log('Open news panel')}
          onNoteClick={() => console.log('Open notes panel')}
        />
      )}
    </div>
  );
});

AccountCanvas.displayName = "AccountCanvas";

// ─────────────────────────────────────────────────────────────────────────────
// Node factory functions (pure — no hooks, no closures over component state)
// ─────────────────────────────────────────────────────────────────────────────
const createCompanyNode = (name: string, x: number, y: number): Group => {
  const badgeW = Math.max(160, name.length * 9 + 48);
  const badge = new Rect({ width: badgeW, height: 44, fill: "hsl(221 83% 53%)", rx: 22, ry: 22, originX: "center", originY: "center" });
  const dot1 = new Circle({ radius: 3, fill: "white", opacity: 0.5, left: -badgeW / 2 + 16, top: 0, originX: "center", originY: "center" });
  const dot2 = new Circle({ radius: 3, fill: "white", opacity: 0.5, left: badgeW / 2 - 16, top: 0, originX: "center", originY: "center" });
  const label = new Text(name, { fontSize: 15, fontWeight: "600", fill: "white", originX: "center", originY: "center", top: 1 });
  return new Group([badge, dot1, dot2, label], { left: x, top: y, originX: "center", originY: "center", selectable: false, hasControls: false, hasBorders: false });
};

const createContactNode = (contact: Contact, x: number, y: number): Group => {
  const statusColors: Record<string, string> = {
    champion: "hsl(142 71% 45%)", engaged: "hsl(142 71% 45%)", warm: "hsl(38 92% 50%)",
    new: "hsl(221 83% 53%)", blocker: "hsl(0 84% 60%)", unknown: "hsl(210 20% 90%)",
  };
  const bgColor = statusColors[contact.status] || statusColors.unknown;
  const cardBg = new Rect({ width: 180, height: 90, fill: "hsl(222 47% 14%)", stroke: "hsl(221 83% 53%)", strokeWidth: 1, rx: 8, ry: 8, left: -90, top: -45 });
  const profileCircle = new Circle({ radius: 25, fill: "hsl(217 33% 22%)", left: -75, top: -20 });
  const silhouetteText = new Text("👤", { fontSize: 24, fill: "hsl(215 20% 65%)", left: -75, top: -20, originX: "center", originY: "center" });
  const nameText = new Text(contact.name, { fontSize: 11, fontWeight: "600", fill: "hsl(210 40% 98%)", left: -40, top: -25, width: 110 });
  const titleText = new Text(contact.title, { fontSize: 9, fill: "hsl(215 20% 65%)", left: -40, top: -8, width: 110 });
  const deptText = new Text(contact.department, { fontSize: 8, fill: "hsl(199 89% 60%)", left: -40, top: 8, width: 110 });
  const statusIndicator = new Circle({ radius: 5, fill: bgColor, left: 65, top: -35 });
  const anchorTop = new Circle({ radius: 4, fill: "hsl(221 83% 53%)", top: -50, opacity: 0 });
  const anchorBottom = new Circle({ radius: 4, fill: "hsl(221 83% 53%)", top: 50, opacity: 0 });
  return new Group([cardBg, profileCircle, silhouetteText, nameText, titleText, deptText, statusIndicator, anchorTop, anchorBottom], {
    left: x, top: y, originX: "center", originY: "center",
    selectable: false, evented: true, hasControls: false, hasBorders: false,
  });
};

const createTalentNode = (engagement: TalentEngagementWithData, x: number, y: number): Group => {
  const statusColors: Record<EngagementStatus, { bg: string; border: string; text: string }> = {
    proposed: { bg: "hsl(45 93% 95%)", border: "hsl(45 93% 47%)", text: "Proposed" },
    interviewing: { bg: "hsl(221 83% 95%)", border: "hsl(221 83% 53%)", text: "Interviewing" },
    deployed: { bg: "hsl(142 71% 95%)", border: "hsl(142 71% 45%)", text: "Deployed" },
  };
  const colors = statusColors[engagement.status];
  const talent = engagement.talent;
  const cardBg = new Rect({ width: 180, height: 90, fill: colors.bg, stroke: colors.border, strokeWidth: 2, strokeDashArray: [8, 4], rx: 8, ry: 8, left: -90, top: -45 });
  const badgeBg = new Rect({ width: 60, height: 18, fill: colors.border, rx: 9, ry: 9, left: -30, top: -55 });
  const badgeText = new Text("TALENT", { fontSize: 9, fontWeight: "bold", fill: "white", left: 0, top: -55, originX: "center", originY: "center" });
  const nameText = new Text(talent.name, { fontSize: 11, fontWeight: "600", fill: "hsl(222 47% 11%)", left: -40, top: -20, width: 120 });
  const titleText = new Text(talent.roleType || '', { fontSize: 9, fill: "hsl(215 16% 47%)", left: -40, top: -5, width: 120 });
  const statusText = new Text(colors.text, { fontSize: 8, fill: colors.border, left: -40, top: 10, width: 120, fontWeight: "600" });
  return new Group([cardBg, badgeBg, badgeText, nameText, titleText, statusText], {
    left: x, top: y, originX: "center", originY: "center",
    selectable: false, evented: true, hasControls: false, hasBorders: false,
  });
};
