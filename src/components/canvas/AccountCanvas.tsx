import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { toast } from "sonner";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { buildOrgChartLayout } from "@/lib/seniority-inference";

interface TalentEngagementWithData extends TalentEngagement {
  talent: Talent;
}

interface AccountCanvasProps {
  account: Account;
  onContactClick: (contact: Contact) => void;
  onTalentClick?: (talent: Talent, engagement: TalentEngagement) => void;
  highlightedContactIds?: string[];
  showTalentOverlay?: boolean;
  talentEngagements?: TalentEngagementWithData[];
  onSetParent?: (childContactId: string, parentContactId: string | null) => void;
  onSetCeo?: (contactId: string) => void;
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

// ── Drop zone types for insertion hints ──
type DropZone = "child" | "sibling" | "root-replace";

interface DropTarget {
  contactId: string;
  zone: DropZone;
  group: Group;
}

export const AccountCanvas = forwardRef<AccountCanvasRef, AccountCanvasProps>(({ 
  account, 
  onContactClick,
  onTalentClick,
  highlightedContactIds = [],
  showTalentOverlay = false,
  talentEngagements = [],
  onSetParent,
  onSetCeo,
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
  
  const onContactClickRef = useRef(onContactClick);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  const onSetParentRef = useRef(onSetParent);
  useEffect(() => { onSetParentRef.current = onSetParent; }, [onSetParent]);
  const onSetCeoRef = useRef(onSetCeo);
  useEffect(() => { onSetCeoRef.current = onSetCeo; }, [onSetCeo]);
  
  const companyNodeRef = useRef<Group | null>(null);
  const isCanvasDisposedRef = useRef(false);
  const hierarchyLinesRef = useRef<Line[]>([]);
  const edgeRebuildGenRef = useRef(0);
  
  // Drop hint visuals
  const dropHintRef = useRef<Rect | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const dropGuideLineRef = useRef<Line | null>(null);
  
  // Auto-pan
  const autoPanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeDragNodeRef = useRef<Group | null>(null);
  const AUTO_PAN_EDGE = 40;
  const AUTO_PAN_SPEED = 10;
  
  // Layout constants
  const NODE_W = 180;
  const NODE_H = 90;
  const VERTICAL_GAP = 60;
  const HORIZONTAL_GAP = 40;
  const SNAP_RADIUS = 50; // px to detect drop target
  const COMPANY_SNAP_RADIUS = 70;
  
  // Hover intent for company node
  const companyHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCompanyDraggingRef = useRef(false);
  const companyDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const HOVER_DELAY = 700;
  const DRAG_THRESHOLD = 5;
  
  // ── Auto-pan near edges ──
  const startAutoPan = useCallback((canvas: FabricCanvas, mouseX: number, mouseY: number) => {
    if (autoPanIntervalRef.current) clearInterval(autoPanIntervalRef.current);
    const cw = canvas.width!;
    const ch = canvas.height!;
    let dx = 0, dy = 0;
    if (mouseX < AUTO_PAN_EDGE) dx = AUTO_PAN_SPEED * ((AUTO_PAN_EDGE - mouseX) / AUTO_PAN_EDGE);
    else if (mouseX > cw - AUTO_PAN_EDGE) dx = -AUTO_PAN_SPEED * ((mouseX - (cw - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE);
    if (mouseY < AUTO_PAN_EDGE) dy = AUTO_PAN_SPEED * ((AUTO_PAN_EDGE - mouseY) / AUTO_PAN_EDGE);
    else if (mouseY > ch - AUTO_PAN_EDGE) dy = -AUTO_PAN_SPEED * ((mouseY - (ch - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE);
    if (dx === 0 && dy === 0) {
      if (autoPanIntervalRef.current) { clearInterval(autoPanIntervalRef.current); autoPanIntervalRef.current = null; }
      return;
    }
    autoPanIntervalRef.current = setInterval(() => {
      const vpt = canvas.viewportTransform!;
      vpt[4] += dx; vpt[5] += dy;
      const dragNode = activeDragNodeRef.current;
      if (dragNode) {
        const zoom = canvas.getZoom();
        dragNode.set({ left: (dragNode.left ?? 0) - dx / zoom, top: (dragNode.top ?? 0) - dy / zoom });
        dragNode.setCoords();
      }
      canvas.requestRenderAll();
    }, 16);
  }, []);
  
  const stopAutoPan = useCallback(() => {
    if (autoPanIntervalRef.current) { clearInterval(autoPanIntervalRef.current); autoPanIntervalRef.current = null; }
  }, []);

  // ── Clear drop hints ──
  const clearDropHints = useCallback((canvas: FabricCanvas) => {
    if (dropHintRef.current) { try { canvas.remove(dropHintRef.current); } catch {} dropHintRef.current = null; }
    if (dropGuideLineRef.current) { try { canvas.remove(dropGuideLineRef.current); } catch {} dropGuideLineRef.current = null; }
    dropTargetRef.current = null;
  }, []);

  // ── Show drop hint ──
  const showDropHint = useCallback((canvas: FabricCanvas, targetGroup: Group, zone: DropZone) => {
    clearDropHints(canvas);
    const tc = targetGroup.getCenterPoint();
    
    let hintX = tc.x;
    let hintY = tc.y;
    let hintW = NODE_W + 20;
    let hintH = 6;
    
    if (zone === "child") {
      // Below the target
      hintY = tc.y + NODE_H / 2 + VERTICAL_GAP / 2;
      hintW = NODE_W;
      hintH = 6;
    } else if (zone === "sibling") {
      // To the right of the target
      hintX = tc.x + NODE_W / 2 + HORIZONTAL_GAP / 2;
      hintW = 6;
      hintH = NODE_H;
    } else if (zone === "root-replace") {
      // Highlight company root area
      hintY = tc.y + 50;
      hintW = NODE_W;
      hintH = 6;
    }
    
    const hint = new Rect({
      left: hintX - hintW / 2,
      top: hintY - hintH / 2,
      width: hintW,
      height: hintH,
      fill: "hsl(221 83% 53%)",
      opacity: 0.6,
      rx: 3,
      ry: 3,
      selectable: false,
      evented: false,
    });
    canvas.add(hint);
    dropHintRef.current = hint;
    
    // Guide line from target to hint
    const guide = new Line([tc.x, tc.y + NODE_H / 2, hintX, hintY], {
      stroke: "hsl(221 83% 53%)",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      opacity: 0.5,
    });
    canvas.add(guide);
    dropGuideLineRef.current = guide;
  }, [clearDropHints]);

  // ── Canvas initialization ──
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    isCanvasDisposedRef.current = false;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const canvas = new FabricCanvas(canvasRef.current, {
      width, height,
      backgroundColor: "hsl(210 40% 98%)",
      selection: false,
    });

    // Zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.max(0.3, Math.min(3, zoom));
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan on background drag
    let isDragging = false;
    let lastPosX = 0, lastPosY = 0;

    canvas.on('mouse:down', (opt) => {
      if (!opt.target) {
        isDragging = true;
        canvas.selection = false;
        lastPosX = (opt.e as MouseEvent).clientX;
        lastPosY = (opt.e as MouseEvent).clientY;
        canvas.setCursor('grab');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isDragging) {
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - lastPosX;
        vpt[5] += evt.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:up', () => {
      canvas.setViewportTransform(canvas.viewportTransform!);
      isDragging = false;
      canvas.selection = false;
      canvas.setCursor('default');
    });

    setFabricCanvas(canvas);

    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
        canvas.renderAll();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      isCanvasDisposedRef.current = true;
      canvas.dispose();
    };
  }, []);

  // ── Main render effect ──
  useEffect(() => {
    if (!fabricCanvas || !account || isCanvasDisposedRef.current) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();
    hierarchyLinesRef.current = [];

    const canvasW = fabricCanvas.width!;
    const layout = buildOrgChartLayout(account.contacts);

    const EXEC_ROW_Y = 200;
    const DEPT_HEADER_H = 30;
    const DEPT_START_Y = EXEC_ROW_Y + NODE_H + VERTICAL_GAP + 30;

    // ── Company node at top ──
    const companyNode = createCompanyNode(account.name, canvasW / 2, 80);
    
    const cancelCompanyHoverTimer = () => {
      if (companyHoverTimerRef.current) { clearTimeout(companyHoverTimerRef.current); companyHoverTimerRef.current = null; }
    };

    companyNode.on('mouseover', function() {
      if (isCompanyDraggingRef.current) return;
      (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 4 } });
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

    let companyLastPosX = 0, companyLastPosY = 0;
    companyNode.on('mousedown', (opt) => {
      const evt = opt.e as MouseEvent;
      companyDragStartPosRef.current = { x: evt.clientX, y: evt.clientY };
      companyLastPosX = evt.clientX;
      companyLastPosY = evt.clientY;
      isCompanyDraggingRef.current = false;
      cancelCompanyHoverTimer();
    });

    fabricCanvas.on('mouse:move', (opt) => {
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
    });

    fabricCanvas.on('mouse:up', () => {
      if (companyDragStartPosRef.current) {
        setTimeout(() => { isCompanyDraggingRef.current = false; companyDragStartPosRef.current = null; }, 100);
      }
    });

    companyNodeRef.current = companyNode;
    fabricCanvas.add(companyNode);

    // ── Build hierarchy maps ──
    const contactMap = new Map<string, Contact>();
    account.contacts.forEach(c => contactMap.set(c.id, c));

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

    const computeDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      if (depthMap.has(id)) return depthMap.get(id)!;
      const parent = parentMap.get(id);
      const d = parent ? computeDepth(parent, visited) + 1 : 0;
      depthMap.set(id, d);
      return d;
    };
    account.contacts.forEach(c => computeDepth(c.id));

    // ── Wire up contact node with tree drag-drop ──
    const wireContactNode = (contact: Contact, node: Group, x: number, y: number) => {
      // --- DRAG: show insertion hints ---
      node.on('moving', function(opt) {
        activeDragNodeRef.current = node;
        const center = node.getCenterPoint();
        
        // Rebuild edges during drag for real-time visual feedback
        rebuildAllEdges(fabricCanvas, canvasW);
        clearDropHints(fabricCanvas);

        // Check proximity to company root
        if (companyNodeRef.current) {
          const companyCenter = companyNodeRef.current.getCenterPoint();
          const dist = Math.sqrt(Math.pow(center.x - companyCenter.x, 2) + Math.pow(center.y - companyCenter.y, 2));
          if (dist < COMPANY_SNAP_RADIUS + NODE_H / 2) {
            showDropHint(fabricCanvas, companyNodeRef.current, "root-replace");
            dropTargetRef.current = { contactId: "__company_root__", zone: "root-replace", group: companyNodeRef.current };
            if (opt.e) startAutoPan(fabricCanvas, (opt.e as MouseEvent).offsetX, (opt.e as MouseEvent).offsetY);
            fabricCanvas.renderAll();
            return;
          }
        }

        // Find nearest contact node for drop target
        let bestTarget: { id: string; group: Group; dist: number; zone: DropZone } | null = null;

        contactNodesRef.current.forEach((otherData, otherId) => {
          if (otherId === contact.id) return;
          const otherCenter = otherData.group.getCenterPoint();
          const dx = center.x - otherCenter.x;
          const dy = center.y - otherCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < SNAP_RADIUS + NODE_H) {
            // Determine zone: below = child, side = sibling
            let zone: DropZone;
            if (dy > NODE_H / 3) {
              zone = "child"; // dragged node is below target → becomes child
            } else if (Math.abs(dx) > NODE_W / 3) {
              zone = "sibling"; // dragged node is beside target → becomes sibling
            } else {
              zone = "child"; // default to child
            }

            if (!bestTarget || dist < bestTarget.dist) {
              bestTarget = { id: otherId, group: otherData.group, dist, zone };
            }
          }
        });

        if (bestTarget) {
          showDropHint(fabricCanvas, bestTarget.group, bestTarget.zone);
          dropTargetRef.current = { contactId: bestTarget.id, zone: bestTarget.zone, group: bestTarget.group };
        }

        if (opt.e) startAutoPan(fabricCanvas, (opt.e as MouseEvent).offsetX, (opt.e as MouseEvent).offsetY);
        fabricCanvas.renderAll();
      });

      // --- DROP: commit hierarchy change ---
      node.on('modified', function() {
        activeDragNodeRef.current = null;
        stopAutoPan();
        
        const target = dropTargetRef.current;
        clearDropHints(fabricCanvas);

        if (target) {
          if (target.contactId === "__company_root__") {
            // Dropped on company root → replace structural root
            const isCeo = account.ceoContactId === contact.id;
            if (!isCeo) {
              toast("Replace the current structural root?", {
                action: { label: "Set as Root", onClick: () => onSetCeoRef.current?.(contact.id) },
                duration: 6000,
              });
            }
          } else if (target.zone === "child") {
            // Become child of target
            onSetParentRef.current?.(contact.id, target.contactId);
          } else if (target.zone === "sibling") {
            // Become sibling: share parent of target
            const targetContact = contactMap.get(target.contactId);
            const newParent = targetContact?.managerId || null;
            onSetParentRef.current?.(contact.id, newParent);
          }
        }

        rebuildAllEdges(fabricCanvas, canvasW);
        fabricCanvas.renderAll();
      });

      // --- Hover: hierarchy highlighting ---
      node.on('mouseover', function() {
        (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 } });
        
        const ancestors = new Set<string>();
        let current = contact.id;
        while (parentMap.has(current)) { current = parentMap.get(current)!; ancestors.add(current); }

        const descendants = new Set<string>();
        const collectDesc = (id: string) => {
          (childrenMap.get(id) || []).forEach(kid => { descendants.add(kid); collectDesc(kid); });
        };
        collectDesc(contact.id);

        contactNodesRef.current.forEach((otherData, otherId) => {
          if (otherId === contact.id) return;
          if (ancestors.has(otherId) || descendants.has(otherId)) {
            otherData.group.set({ opacity: 1 });
          } else {
            otherData.group.set({ opacity: 0.8 });
          }
        });

        hierarchyLinesRef.current.forEach(l => l.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 }));
        fabricCanvas.renderAll();
      });

      node.on('mouseout', function() {
        (this as FabricObject).set({ shadow: null });
        contactNodesRef.current.forEach((otherData) => otherData.group.set({ opacity: 1 }));
        hierarchyLinesRef.current.forEach(l => l.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 }));
        fabricCanvas.renderAll();
      });

      // --- Click / double-click ---
      node.on('mousedblclick', () => {
        onContactClickRef.current(contact);
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
    const animateDrawIn = (canvas: FabricCanvas, line: Line, duration: number = 200) => {
      const targetX2 = line.x2!;
      const targetY2 = line.y2!;
      const startX = line.x1!;
      const startY = line.y1!;
      line.set({ x2: startX, y2: startY, opacity: 0 });
      line.setCoords();
      const steps = Math.max(1, Math.round(duration / 16));
      let step = 0;
      const tick = () => {
        step++;
        const t = step / steps;
        const eased = 1 - (1 - t) * (1 - t);
        line.set({ x2: startX + (targetX2 - startX) * eased, y2: startY + (targetY2 - startY) * eased, opacity: eased });
        line.setCoords();
        canvas.requestRenderAll();
        if (step < steps) requestAnimationFrame(tick);
        else { line.set({ opacity: 1 }); canvas.requestRenderAll(); }
      };
      requestAnimationFrame(tick);
    };

    const pulseNode = (canvas: FabricCanvas, group: Group) => {
      const steps = 20;
      let step = 0;
      const tick = () => {
        step++;
        const t = step / steps;
        const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
        group.set({ shadow: { color: 'hsl(221 83% 53%)', blur: 10 + intensity * 20, offsetX: 0, offsetY: 0 } });
        canvas.requestRenderAll();
        if (step < steps) requestAnimationFrame(tick);
        else { group.set({ shadow: null }); canvas.requestRenderAll(); }
      };
      requestAnimationFrame(tick);
    };

    // ── Orthogonal edge helper ──
    const createOrthogonalEdge = (
      canvas: FabricCanvas, x1: number, y1: number, x2: number, y2: number,
      strokeColor: string, strokeWidth: number, animated: boolean,
    ) => {
      const midY = y1 + (y2 - y1) / 2;
      const segments = [[x1, y1, x1, midY], [x1, midY, x2, midY], [x2, midY, x2, y2]];
      segments.forEach(([sx1, sy1, sx2, sy2]) => {
        const line = new Line([sx1, sy1, sx2, sy2], {
          stroke: strokeColor, strokeWidth, selectable: false, evented: false,
        });
        canvas.add(line);
        canvas.sendObjectToBack(line);
        hierarchyLinesRef.current.push(line);
        if (animated) animateDrawIn(canvas, line, 200);
      });
    };

    // ── Ephemeral edge rebuild ──
    const rebuildAllEdges = (canvas: FabricCanvas, cw: number, animated: boolean = false) => {
      const gen = ++edgeRebuildGenRef.current;
      const oldLines = [...hierarchyLinesRef.current];
      hierarchyLinesRef.current = [];
      oldLines.forEach(line => { try { canvas.remove(line); } catch {} });
      drawFreshEdges(canvas, cw, animated, gen);
    };

    const drawFreshEdges = (canvas: FabricCanvas, cw: number, animated: boolean, gen: number) => {
      if (gen !== edgeRebuildGenRef.current) return;

      contactNodesRef.current.forEach((childData, childId) => {
        const contact = childData.contact;
        if (contact.managerId && contactNodesRef.current.has(contact.managerId)) {
          const parentData = contactNodesRef.current.get(contact.managerId)!;
          const parentCenter = parentData.group.getCenterPoint();
          const childCenter = childData.group.getCenterPoint();
          const depth = depthMap.get(childId) || 1;
          const baseStrokeWidth = depth === 0 ? 3 : 2;
          const lightness = Math.min(91 + depth * 1, 95);

          const px = parentCenter.x, py = parentCenter.y + NODE_H / 2;
          const cx = childCenter.x, cy = childCenter.y - NODE_H / 2;

          if (Math.abs(px - cx) < 4) {
            const line = new Line([px, py, cx, cy], {
              stroke: `hsl(214 32% ${lightness}%)`, strokeWidth: baseStrokeWidth, selectable: false, evented: false,
            });
            canvas.add(line); canvas.sendObjectToBack(line);
            hierarchyLinesRef.current.push(line);
            if (animated) animateDrawIn(canvas, line, 200);
          } else {
            createOrthogonalEdge(canvas, px, py, cx, cy, `hsl(214 32% ${lightness}%)`, baseStrokeWidth, animated);
          }
        } else if (!contact.managerId && account.ceoContactId === childId) {
          const childCenter = childData.group.getCenterPoint();
          const px = cw / 2, py = 120;
          const cx = childCenter.x, cy = childCenter.y - NODE_H / 2;

          if (Math.abs(px - cx) < 4) {
            const line = new Line([px, py, cx, cy], {
              stroke: `hsl(214 32% 91%)`, strokeWidth: 3, selectable: false, evented: false,
            });
            canvas.add(line); canvas.sendObjectToBack(line);
            hierarchyLinesRef.current.push(line);
            if (animated) animateDrawIn(canvas, line, 200);
          } else {
            createOrthogonalEdge(canvas, px, py, cx, cy, `hsl(214 32% 91%)`, 3, animated);
          }
        }
      });
    };

    // ── Place executives row ──
    const execCount = layout.executives.length;
    if (execCount > 0) {
      const execTotalW = execCount * NODE_W + (execCount - 1) * HORIZONTAL_GAP;
      const execStartX = canvasW / 2 - execTotalW / 2 + NODE_W / 2;

      layout.executives.forEach((exec, i) => {
        const x = execStartX + i * (NODE_W + HORIZONTAL_GAP);
        const y = EXEC_ROW_Y;
        const contact = contactMap.get(exec.contactId);
        if (!contact) return;
        const node = createContactNode(contact, x, y);
        wireContactNode(contact, node, x, y);
      });
    }

    // ── Place department columns ──
    const deptCount = layout.departments.length;
    if (deptCount > 0) {
      const deptTotalW = deptCount * NODE_W + (deptCount - 1) * (HORIZONTAL_GAP * 2);
      const deptStartX = canvasW / 2 - deptTotalW / 2 + NODE_W / 2;

      layout.departments.forEach((dept, deptIdx) => {
        const deptX = deptStartX + deptIdx * (NODE_W + HORIZONTAL_GAP * 2);

        const deptLabel = new Text(dept.name, {
          fontSize: 11, fontWeight: "bold", fill: "hsl(215 16% 47%)",
          left: deptX, top: DEPT_START_Y - 10, originX: "center", originY: "center",
          selectable: false, evented: false,
        });
        fabricCanvas.add(deptLabel);

        dept.nodes.forEach((orgNode, nodeIdx) => {
          const y = DEPT_START_Y + DEPT_HEADER_H + nodeIdx * (NODE_H + VERTICAL_GAP);
          const contact = contactMap.get(orgNode.contactId);
          if (!contact) return;
          const node = createContactNode(contact, deptX, y);
          wireContactNode(contact, node, deptX, y);
        });
      });
    }

    // ── Draw initial edges ──
    rebuildAllEdges(fabricCanvas, canvasW);
    fabricCanvas.renderAll();
  }, [fabricCanvas, account]);

  // ── Talent overlay ──
  useEffect(() => {
    if (!fabricCanvas) return;
    talentNodesRef.current.forEach(({ group }) => fabricCanvas.remove(group));
    talentNodesRef.current.clear();

    if (!showTalentOverlay || talentEngagements.length === 0) {
      fabricCanvas.renderAll();
      return;
    }

    const engagementsByDept = new Map<string, TalentEngagementWithData[]>();
    talentEngagements.forEach((eng) => {
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
        const x = baseX;
        const y = baseY + idx * 100;
        const talentNode = createTalentNode(eng, x, y);
        talentNode.on('mouseover', function() {
          fabricCanvas.setCursor('pointer');
          (this as FabricObject).set({ shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 } });
          fabricCanvas.renderAll();
        });
        talentNode.on('mouseout', function() {
          fabricCanvas.setCursor('default');
          (this as FabricObject).set({ shadow: null });
          fabricCanvas.renderAll();
        });
        talentNode.on('mousedown', () => {
          if (onTalentClick) onTalentClick(eng.talent, eng);
        });
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
        cardBg.set({ stroke: originalStroke as string || "hsl(214 32% 91%)", strokeWidth: originalStrokeWidth || 1 });
      });
      setMatchedNodes([]);
      fabricCanvas?.renderAll();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches: ContactNodeData[] = [];

    contactNodesRef.current.forEach((nodeData) => {
      const { contact, group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof cardBg.stroke === 'string' ? cardBg.stroke : null;
        nodeData.originalStrokeWidth = cardBg.strokeWidth;
      }

      const isMatch = contact.name.toLowerCase().includes(lowerQuery) ||
        contact.title.toLowerCase().includes(lowerQuery) ||
        contact.department.toLowerCase().includes(lowerQuery);

      if (isMatch) {
        matches.push(nodeData);
        cardBg.set({ stroke: "hsl(221 83% 53%)", strokeWidth: 3 });
      } else {
        cardBg.set({ stroke: nodeData.originalStroke as string || "hsl(214 32% 91%)", strokeWidth: nodeData.originalStrokeWidth || 1 });
      }
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
    fabricCanvas.setZoom(1);
    fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    contactNodesRef.current.forEach(({ group, originalStroke, originalStrokeWidth }) => {
      const cardBg = group.getObjects()[0] as Rect;
      cardBg.set({ stroke: originalStroke as string || "hsl(214 32% 91%)", strokeWidth: originalStrokeWidth || 1 });
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
        cardBg.set({ stroke: nodeData.originalStroke as string || "hsl(214 32% 91%)", strokeWidth: nodeData.originalStrokeWidth || 1 });
        group.set({ shadow: null });
      }
    });
    fabricCanvas.renderAll();

    if (contactIds.length > 0) {
      const highlightedNodes = contactIds.map(id => contactNodesRef.current.get(id)).filter(Boolean);
      if (highlightedNodes.length === 1) {
        zoomToNode(highlightedNodes[0]!.group);
      } else if (highlightedNodes.length > 1) {
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
        y: (center.y - 45) * zoom + vpt[5] + containerRect.top,
      };
    },
  }));

  const handleResetPositions = () => {
    if (!fabricCanvas) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (companyNodeRef.current) {
      const b = companyNodeRef.current.getBoundingRect();
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    }
    contactNodesRef.current.forEach(({ group }) => {
      const b = group.getBoundingRect();
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    });
    if (minX === Infinity) {
      fabricCanvas.setZoom(1); fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0]; fabricCanvas.renderAll(); return;
    }
    const padding = 50;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;
    const cw2 = maxX - minX, ch2 = maxY - minY;
    const ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
    const canvasWidth = fabricCanvas.width!, canvasHeight = fabricCanvas.height!;
    const targetZoom = Math.min(canvasWidth / cw2, canvasHeight / ch2, 1);
    const targetVptX = canvasWidth / 2 - ccx * targetZoom;
    const targetVptY = canvasHeight / 2 - ccy * targetZoom;

    const currentZoom = fabricCanvas.getZoom();
    const currentVpt = [...fabricCanvas.viewportTransform!];
    const steps = 20;
    let step = 0;
    const animate = () => {
      if (step < steps) {
        step++;
        fabricCanvas.setZoom(currentZoom + ((targetZoom - currentZoom) / steps) * step);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = currentVpt[4] + ((targetVptX - currentVpt[4]) / steps) * step;
        vpt[5] = currentVpt[5] + ((targetVptY - currentVpt[5]) / steps) * step;
        fabricCanvas.renderAll();
        requestAnimationFrame(animate);
      }
    };
    animate();
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

// ── Static node creation helpers ──

const createCompanyNode = (name: string, x: number, y: number): Group => {
  const buildingMain = new Rect({ width: 50, height: 60, fill: "hsl(221 83% 53%)", originX: "center", originY: "center" });
  const buildingTop = new Rect({ width: 30, height: 15, fill: "hsl(221 83% 53%)", originX: "center", originY: "center", top: -30 });

  const windows: Rect[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      windows.push(new Rect({
        width: 6, height: 8, fill: "white", opacity: 0.7,
        left: -15 + col * 10, top: -20 + row * 12, originX: "center", originY: "center",
      }));
    }
  }

  const text = new Text(name.toUpperCase(), {
    fontSize: 14, fontWeight: "bold", fill: "hsl(221 83% 53%)",
    originX: "center", originY: "center", top: -55,
  });

  return new Group([buildingMain, buildingTop, ...windows, text], {
    left: x, top: y, originX: "center", originY: "center",
    selectable: false, hasControls: false, hasBorders: false,
  });
};

const createContactNode = (contact: Contact, x: number, y: number): Group => {
  const statusColors: Record<string, string> = {
    champion: "hsl(142 71% 45%)", engaged: "hsl(142 71% 45%)", warm: "hsl(38 92% 50%)",
    new: "hsl(221 83% 53%)", blocker: "hsl(0 84% 60%)", unknown: "hsl(210 20% 90%)",
  };
  const bgColor = statusColors[contact.status] || statusColors.unknown;

  const cardBg = new Rect({ width: 180, height: 90, fill: "white", stroke: "hsl(214 32% 91%)", strokeWidth: 1, rx: 8, ry: 8, left: -90, top: -45 });
  const profileCircle = new Circle({ radius: 25, fill: "hsl(210 20% 90%)", left: -75, top: -20 });
  const silhouetteText = new Text("👤", { fontSize: 24, fill: "hsl(215 16% 47%)", left: -75, top: -20, originX: "center", originY: "center" });
  const nameText = new Text(contact.name, { fontSize: 11, fontWeight: "600", fill: "hsl(222 47% 11%)", left: -40, top: -25, width: 110 });
  const titleText = new Text(contact.title, { fontSize: 9, fill: "hsl(215 16% 47%)", left: -40, top: -8, width: 110 });
  const deptText = new Text(contact.department, { fontSize: 8, fill: "hsl(215 16% 47%)", left: -40, top: 8, width: 110 });
  const statusIndicator = new Circle({ radius: 5, fill: bgColor, left: 65, top: -35 });
  const anchorTop = new Circle({ radius: 4, fill: "hsl(221 83% 53%)", top: -50, opacity: 0 });
  const anchorBottom = new Circle({ radius: 4, fill: "hsl(221 83% 53%)", top: 50, opacity: 0 });

  return new Group([cardBg, profileCircle, silhouetteText, nameText, titleText, deptText, statusIndicator, anchorTop, anchorBottom], {
    left: x, top: y, originX: "center", originY: "center",
    selectable: true, hasControls: false, hasBorders: false,
    lockRotation: true, lockScalingX: true, lockScalingY: true,
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
  const badgeBg = new Rect({ width: 60, height: 18, fill: colors.border, rx: 9, ry: 9, left: -30, top: -40 });
  const badgeText = new Text(colors.text, { fontSize: 8, fill: "white", fontWeight: "bold", left: 0, top: -40, originX: "center", originY: "center" });
  const nameText = new Text(talent.name, { fontSize: 11, fontWeight: "600", fill: "hsl(222 47% 11%)", left: -75, top: -15, width: 150 });
  const roleText = new Text(engagement.roleType || talent.roleType, { fontSize: 9, fill: "hsl(215 16% 47%)", left: -75, top: 2, width: 150 });
  const rateText = new Text(talent.rate || "", { fontSize: 8, fill: "hsl(215 16% 47%)", left: -75, top: 18, width: 150 });

  return new Group([cardBg, badgeBg, badgeText, nameText, roleText, rateText], {
    left: x, top: y, originX: "center", originY: "center",
    selectable: false, hasControls: false, hasBorders: false,
  });
};
