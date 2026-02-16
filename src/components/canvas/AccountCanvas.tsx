import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { toast } from "sonner";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { User, Users } from "lucide-react";
import { buildOrgChartLayout, SENIORITY_LABELS } from "@/lib/seniority-inference";
import { supabase } from "@/integrations/supabase/client";

interface TalentEngagementWithData extends TalentEngagement {
  talent: Talent;
}

export type CanvasInteractionMode = "browse" | "edit";

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
  lockedNodeIds?: Set<string>;
  onSnapEdgeCreate?: (fromContactId: string, toContactId: string) => void;
  onUnlinkFromManager?: (contactId: string) => void;
  onSetCeo?: (contactId: string) => void;
  workspaceId?: string;
  linkModeSourceId?: string | null;
  onLinkModeSelect?: (targetContactId: string) => void;
  onLinkModeCancel?: () => void;
  autoArrangeOnDrop?: boolean;
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
  lockedNodeIds = new Set(),
  onSnapEdgeCreate,
  onUnlinkFromManager,
  onSetCeo,
  workspaceId,
  linkModeSourceId = null,
  onLinkModeSelect,
  onLinkModeCancel,
  autoArrangeOnDrop = true,
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
  const lockedNodeIdsRef = useRef(lockedNodeIds);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onContactClickRef = useRef(onContactClick);
  
  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
  useEffect(() => { lockedNodeIdsRef.current = lockedNodeIds; }, [lockedNodeIds]);
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  const companyNodeRef = useRef<Group | null>(null);
  const isCanvasDisposedRef = useRef(false);
  const hierarchyLinesRef = useRef<Line[]>([]);
  const edgeRebuildGenRef = useRef(0); // generation counter to invalidate stale animated rebuilds
  
  // Smart snap system refs
  const guideLinesToRef = useRef<Line[]>([]);
  const snapHighlightRef = useRef<Rect | null>(null);
  const snapTargetRef = useRef<string | null>(null); // contact id of potential parent
  const autoPanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSnapEdgeCreateRef = useRef(onSnapEdgeCreate);
  useEffect(() => { onSnapEdgeCreateRef.current = onSnapEdgeCreate; }, [onSnapEdgeCreate]);
  const onUnlinkFromManagerRef = useRef(onUnlinkFromManager);
  useEffect(() => { onUnlinkFromManagerRef.current = onUnlinkFromManager; }, [onUnlinkFromManager]);
  const onSetCeoRef = useRef(onSetCeo);
  useEffect(() => { onSetCeoRef.current = onSetCeo; }, [onSetCeo]);
  const linkModeSourceIdRef = useRef(linkModeSourceId);
  useEffect(() => { linkModeSourceIdRef.current = linkModeSourceId; }, [linkModeSourceId]);
  const onLinkModeSelectRef = useRef(onLinkModeSelect);
  useEffect(() => { onLinkModeSelectRef.current = onLinkModeSelect; }, [onLinkModeSelect]);
  const onLinkModeCancelRef = useRef(onLinkModeCancel);
  useEffect(() => { onLinkModeCancelRef.current = onLinkModeCancel; }, [onLinkModeCancel]);
  const linkPreviewLineRef = useRef<Line | null>(null);
  
  // Auto-reflow system refs
  const autoArrangeRef = useRef(autoArrangeOnDrop);
  useEffect(() => { autoArrangeRef.current = autoArrangeOnDrop; }, [autoArrangeOnDrop]);
  // Stores pre-drag positions of all nodes (keyed by contact id)
  const preDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Tracks which nodes were displaced during this drag
  const displacedNodesRef = useRef<Set<string>>(new Set());
  // Whether a drag is currently active (to know when to revert)
  const isDragActiveRef = useRef(false);
  // Reflow overlap margin
  const REFLOW_OVERLAP_MARGIN = 20; // px buffer around node bounding box
  const REFLOW_PUSH_DISTANCE = 60; // px to push overlapping nodes away
  
  // Snap constants
  const SNAP_RADIUS = 40; // px radius to trigger "reports to" snap
  const SNAP_HORIZONTAL_THRESHOLD = 30; // px alignment tolerance
  const SIBLING_SNAP_THRESHOLD = 25; // px to snap siblings equally spaced
  const LANE_SNAP_THRESHOLD = 20; // px to snap into peer/child lanes
  const AUTO_PAN_EDGE = 40; // px from viewport edge to start auto-pan
  const AUTO_PAN_SPEED = 10;
  const COMPANY_SNAP_RADIUS = 60; // px radius around company node to unlink (make top-level)
  
  // Alt key tracking for free-place override
  const altKeyRef = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') altKeyRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') altKeyRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  
  // Guide line management
  const clearGuideLines = useCallback((canvas: FabricCanvas) => {
    guideLinesToRef.current.forEach(line => {
      try { canvas.remove(line); } catch {}
    });
    guideLinesToRef.current = [];
    if (snapHighlightRef.current) {
      try { canvas.remove(snapHighlightRef.current); } catch {}
      snapHighlightRef.current = null;
    }
    snapTargetRef.current = null;
  }, []);
  
  const addGuideLine = useCallback((canvas: FabricCanvas, x1: number, y1: number, x2: number, y2: number) => {
    const line = new Line([x1, y1, x2, y2], {
      stroke: "hsl(221 83% 53%)",
      strokeWidth: 1,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      opacity: 0.7,
    });
    canvas.add(line);
    guideLinesToRef.current.push(line);
  }, []);
  
  const showSnapHighlight = useCallback((canvas: FabricCanvas, targetGroup: Group) => {
    if (snapHighlightRef.current) {
      try { canvas.remove(snapHighlightRef.current); } catch {}
    }
    const bounds = targetGroup.getBoundingRect();
    const highlight = new Rect({
      left: targetGroup.left! - 95,
      top: targetGroup.top! - 50,
      width: 190,
      height: 100,
      fill: "transparent",
      stroke: "hsl(221 83% 53%)",
      strokeWidth: 3,
      rx: 12,
      ry: 12,
      selectable: false,
      evented: false,
      opacity: 0.6,
    });
    canvas.add(highlight);
    snapHighlightRef.current = highlight;
  }, []);

  // ── Auto-reflow: push nearby nodes when dragging over them ──
  const reflowAnimFrames = useRef<Map<string, number>>(new Map());
  
  const animateNodeTo = useCallback((canvas: FabricCanvas, nodeData: ContactNodeData, targetX: number, targetY: number, duration = 120) => {
    const group = nodeData.group;
    const startX = group.left!;
    const startY = group.top!;
    if (Math.abs(startX - targetX) < 1 && Math.abs(startY - targetY) < 1) return;
    
    // Cancel any existing animation for this node
    const existing = reflowAnimFrames.current.get(nodeData.contact.id);
    if (existing) cancelAnimationFrame(existing);
    
    const steps = Math.max(1, Math.round(duration / 16));
    let step = 0;
    const tick = () => {
      step++;
      const t = step / steps;
      const eased = 1 - (1 - t) * (1 - t); // ease-out quad
      group.set({
        left: startX + (targetX - startX) * eased,
        top: startY + (targetY - startY) * eased,
      });
      group.setCoords();
      canvas.requestRenderAll();
      if (step < steps) {
        reflowAnimFrames.current.set(nodeData.contact.id, requestAnimationFrame(tick));
      } else {
        reflowAnimFrames.current.delete(nodeData.contact.id);
      }
    };
    reflowAnimFrames.current.set(nodeData.contact.id, requestAnimationFrame(tick));
  }, []);

  const performReflow = useCallback((canvas: FabricCanvas, dragContactId: string, dragCenterX: number, dragCenterY: number, nodeW: number, nodeH: number) => {
    if (!autoArrangeRef.current) return;
    
    const overlapW = nodeW + REFLOW_OVERLAP_MARGIN * 2;
    const overlapH = nodeH + REFLOW_OVERLAP_MARGIN * 2;
    
    contactNodesRef.current.forEach((otherData, otherId) => {
      if (otherId === dragContactId) return;
      if (lockedNodeIdsRef.current.has(otherId)) return;
      
      // Use pre-drag position for stable comparison (avoids jitter from already-displaced nodes)
      const preDragOther = preDragPositionsRef.current.get(otherId);
      if (!preDragOther) return;
      const otherX = preDragOther.x;
      const otherY = preDragOther.y;
      const dx = dragCenterX - otherX;
      const dy = dragCenterY - otherY;
      
      // Check bounding box overlap
      if (Math.abs(dx) < overlapW / 2 + nodeW / 2 && Math.abs(dy) < overlapH / 2 + nodeH / 2) {
        // Overlapping — push this node away
        if (!displacedNodesRef.current.has(otherId)) {
          displacedNodesRef.current.add(otherId);
        }
        
        // Determine push direction (primarily horizontal to preserve hierarchy rows)
        const pushX = dx <= 0 ? REFLOW_PUSH_DISTANCE : -REFLOW_PUSH_DISTANCE;
        animateNodeTo(canvas, otherData, otherX - nodeW / 2 + pushX, otherY - nodeH / 2);
      } else if (displacedNodesRef.current.has(otherId)) {
        // No longer overlapping — spring back to pre-drag position
        animateNodeTo(canvas, otherData, otherX - nodeW / 2, otherY - nodeH / 2);
        displacedNodesRef.current.delete(otherId);
      }
    });
  }, [animateNodeTo]);
  
  const revertAllDisplaced = useCallback((canvas: FabricCanvas, nodeW: number, nodeH: number) => {
    displacedNodesRef.current.forEach(id => {
      const nodeData = contactNodesRef.current.get(id);
      const preDrag = preDragPositionsRef.current.get(id);
      if (nodeData && preDrag) {
        animateNodeTo(canvas, nodeData, preDrag.x - nodeW / 2, preDrag.y - nodeH / 2, 200);
      }
    });
    displacedNodesRef.current.clear();
  }, [animateNodeTo]);

  // Track the actively-dragged node so auto-pan can move it along with viewport
  const activeDragNodeRef = useRef<Group | null>(null);

  // Auto-pan when near edges – moves both viewport AND the dragged node
  const startAutoPan = useCallback((canvas: FabricCanvas, mouseX: number, mouseY: number) => {
    if (autoPanIntervalRef.current) clearInterval(autoPanIntervalRef.current);
    
    const cw = canvas.width!;
    const ch = canvas.height!;
    let dx = 0, dy = 0;
    
    // Gradual speed: closer to edge = faster pan
    if (mouseX < AUTO_PAN_EDGE) {
      dx = AUTO_PAN_SPEED * ((AUTO_PAN_EDGE - mouseX) / AUTO_PAN_EDGE);
    } else if (mouseX > cw - AUTO_PAN_EDGE) {
      dx = -AUTO_PAN_SPEED * ((mouseX - (cw - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE);
    }
    if (mouseY < AUTO_PAN_EDGE) {
      dy = AUTO_PAN_SPEED * ((AUTO_PAN_EDGE - mouseY) / AUTO_PAN_EDGE);
    } else if (mouseY > ch - AUTO_PAN_EDGE) {
      dy = -AUTO_PAN_SPEED * ((mouseY - (ch - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE);
    }
    
    if (dx === 0 && dy === 0) {
      if (autoPanIntervalRef.current) {
        clearInterval(autoPanIntervalRef.current);
        autoPanIntervalRef.current = null;
      }
      return;
    }
    
    autoPanIntervalRef.current = setInterval(() => {
      const vpt = canvas.viewportTransform!;
      vpt[4] += dx;
      vpt[5] += dy;
      // Move the dragged node in the OPPOSITE direction so it stays under the cursor
      const dragNode = activeDragNodeRef.current;
      if (dragNode) {
        const zoom = canvas.getZoom();
        dragNode.set({
          left: (dragNode.left ?? 0) - dx / zoom,
          top: (dragNode.top ?? 0) - dy / zoom,
        });
        dragNode.setCoords();
      }
      canvas.requestRenderAll();
    }, 16);
  }, []);
  
  const stopAutoPan = useCallback(() => {
    if (autoPanIntervalRef.current) {
      clearInterval(autoPanIntervalRef.current);
      autoPanIntervalRef.current = null;
    }
  }, []);

  // Spacebar-to-pan: while dragging a node, hold Space to pan canvas with node attached
  const spacebarPanRef = useRef(false);
  const spacebarLastMouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeDragNodeRef.current && !spacebarPanRef.current) {
        e.preventDefault();
        spacebarPanRef.current = true;
        stopAutoPan(); // pause edge auto-pan while spacebar panning
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacebarPanRef.current) {
        e.preventDefault();
        spacebarPanRef.current = false;
        spacebarLastMouseRef.current = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [stopAutoPan]);

  // Mouse-move handler for spacebar panning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!spacebarPanRef.current || !fabricCanvas) return;
      const last = spacebarLastMouseRef.current;
      if (last) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] += dx;
        vpt[5] += dy;
        fabricCanvas.requestRenderAll();
      }
      spacebarLastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, [fabricCanvas]);
  
  // Hover intent tracking for company node
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

    // Enable zoom and pan
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 3) zoom = 3;
      if (zoom < 0.3) zoom = 0.3;
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan on background drag
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on('mouse:down', (opt) => {
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

    return () => {
      window.removeEventListener("resize", handleResize);
      isCanvasDisposedRef.current = true;
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !account || isCanvasDisposedRef.current) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();
    hierarchyLinesRef.current = [];

    const canvasW = fabricCanvas.width!;

    // ── Build hierarchical layout ──
    const layout = buildOrgChartLayout(account.contacts);

    // ── Layout constants ──
    const NODE_W = 180;
    const NODE_H = 90;
    const VERTICAL_GAP = 60;
    const HORIZONTAL_GAP = 40;
    const DEPT_HEADER_H = 30;
    const EXEC_ROW_Y = 200;
    const DEPT_START_Y = EXEC_ROW_Y + NODE_H + VERTICAL_GAP + 30;

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
        setTimeout(() => {
          isCompanyDraggingRef.current = false;
          companyDragStartPosRef.current = null;
        }, 100);
      }
    });

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

    // Compute depth for each contact
    const computeDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0; // cycle guard
      visited.add(id);
      if (depthMap.has(id)) return depthMap.get(id)!;
      const parent = parentMap.get(id);
      const d = parent ? computeDepth(parent, visited) + 1 : 0;
      depthMap.set(id, d);
      return d;
    };
    account.contacts.forEach(c => computeDepth(c.id));

    const wireContactNode = (contact: Contact, node: Group, x: number, y: number, depth: number = 0) => {
      depthMap.set(contact.id, depth);
      depthMap.set(contact.id, depth);

      // Track whether we already showed a lock toast this drag
      let lockToastShown = false;

      node.on('moving', function(opt) {
        activeDragNodeRef.current = node;
        
        // Capture pre-drag positions of all nodes on first move
        if (!isDragActiveRef.current) {
          isDragActiveRef.current = true;
          preDragPositionsRef.current.clear();
          displacedNodesRef.current.clear();
          contactNodesRef.current.forEach((nd, nid) => {
            const c = nd.group.getCenterPoint();
            preDragPositionsRef.current.set(nid, { x: c.x, y: c.y });
          });
        }
        // Only allow movement in edit mode and if not locked
        if (interactionModeRef.current !== 'edit') {
          node.set({ left: x, top: y });
          node.setCoords();
          fabricCanvas.requestRenderAll();
          return;
        }
        if (lockedNodeIdsRef.current.has(contact.id)) {
          node.set({ left: x, top: y });
          node.setCoords();
          fabricCanvas.requestRenderAll();
          if (!lockToastShown) {
            lockToastShown = true;
            toast("Position locked", {
              action: {
                label: "Unlock",
                onClick: () => {
                  // Toggle lock via the callback
                  const toggleEvt = new CustomEvent('unlock-node', { detail: contact.id });
                  window.dispatchEvent(toggleEvt);
                },
              },
              duration: 3000,
            });
          }
          return;
        }
        const center = node.getCenterPoint();
        // Rebuild all edges from scratch on every move (ephemeral edges)
        rebuildAllEdges(fabricCanvas, canvasW);
        
        // ── Smart Snap System ──
        clearGuideLines(fabricCanvas);
        
        const dragX = center.x;
        const dragY = center.y;
        
        // Check all other nodes for snap relationships
        let bestParent: { id: string; group: Group; dist: number } | null = null;
        const alignXMatches: number[] = [];
        const alignYMatches: number[] = [];
        
        // Check company node for root snap (CEO-only connection)
        if (companyNodeRef.current) {
          const companyCenter = companyNodeRef.current.getCenterPoint();
          const distToCompany = Math.sqrt(
            Math.pow(dragX - companyCenter.x, 2) + Math.pow(dragY - companyCenter.y, 2)
          );
          if (distToCompany < COMPANY_SNAP_RADIUS + NODE_H / 2) {
            // Show highlight on company node (visual feedback regardless of CEO status)
            showSnapHighlight(fabricCanvas, companyNodeRef.current);
            addGuideLine(fabricCanvas, companyCenter.x, companyCenter.y + 40, dragX, dragY - NODE_H / 2);
            snapTargetRef.current = "__company_root__";
          }
        }
        
        contactNodesRef.current.forEach((otherData, otherId) => {
          if (otherId === contact.id) return;
          const otherCenter = otherData.group.getCenterPoint();
          
          // Check vertical alignment (same X axis)
          if (Math.abs(dragX - otherCenter.x) < SNAP_HORIZONTAL_THRESHOLD) {
            alignXMatches.push(otherCenter.x);
          }
          
          // Check horizontal alignment (same Y axis)
          if (Math.abs(dragY - otherCenter.y) < SIBLING_SNAP_THRESHOLD) {
            alignYMatches.push(otherCenter.y);
          }
          
          // Check "reports to" – use 40px radius from bottom anchor of target node
          const targetBottomX = otherCenter.x;
          const targetBottomY = otherCenter.y + NODE_H / 2;
          const dragTopY = dragY - NODE_H / 2;
          const distFromTargetBottom = Math.sqrt(
            Math.pow(dragX - targetBottomX, 2) + Math.pow(dragTopY - targetBottomY, 2)
          );
          
          if (distFromTargetBottom < SNAP_RADIUS && dragY > otherCenter.y) {
            if (!bestParent || distFromTargetBottom < bestParent.dist) {
              bestParent = { id: otherId, group: otherData.group, dist: distFromTargetBottom };
            }
          }
        });
        
        // Draw vertical alignment guides
        alignXMatches.forEach(ax => {
          addGuideLine(fabricCanvas, ax, dragY - 200, ax, dragY + 200);
        });
        
        // Draw horizontal alignment guides (sibling row)
        if (alignYMatches.length > 0) {
          const snapY = alignYMatches[0];
          addGuideLine(fabricCanvas, dragX - 200, snapY, dragX + 200, snapY);
        }
        
        // Show parent highlight and parent-child axis (takes priority over company snap)
        if (bestParent) {
          // Clear any company snap highlight first
          if (snapTargetRef.current === "__company_root__" && snapHighlightRef.current) {
            try { fabricCanvas.remove(snapHighlightRef.current); } catch {}
            snapHighlightRef.current = null;
          }
          const parentCenter = bestParent.group.getCenterPoint();
          showSnapHighlight(fabricCanvas, bestParent.group);
          addGuideLine(fabricCanvas, parentCenter.x, parentCenter.y + NODE_H / 2, dragX, dragY - NODE_H / 2);
          snapTargetRef.current = bestParent.id;
        } else if (snapTargetRef.current !== "__company_root__") {
          snapTargetRef.current = null;
        }
        
        // Auto-pan near edges
        if (opt.e) {
          const evt = opt.e as MouseEvent;
          startAutoPan(fabricCanvas, evt.offsetX, evt.offsetY);
        }
        
        // Auto-reflow: push overlapping nodes aside
        const dragCenter = node.getCenterPoint();
        performReflow(fabricCanvas, contact.id, dragCenter.x, dragCenter.y, NODE_W, NODE_H);
        
        fabricCanvas.renderAll();
      });
      
      // On drop: clear ALL ephemeral state, create edge if snapped, snap to lane, persist position
      node.on('modified', function() {
        activeDragNodeRef.current = null;
        lockToastShown = false;
        isDragActiveRef.current = false;
        stopAutoPan();
        clearGuideLines(fabricCanvas);
        
        if (interactionModeRef.current !== 'edit') {
          // Revert any displaced nodes
          revertAllDisplaced(fabricCanvas, NODE_W, NODE_H);
          rebuildAllEdges(fabricCanvas, canvasW);
          return;
        }
        
        // Commit displaced node positions (they stay where they are)
        // and rebuild edges to reflect new positions
        displacedNodesRef.current.clear();
        preDragPositionsRef.current.clear();
        
        // ── Lane snapping on drop (unless Alt held) ──
        if (!altKeyRef.current) {
          const center = node.getCenterPoint();
          let snapX: number | null = null;
          let snapY: number | null = null;

          // Compute lane positions: siblings share a Y row, children share parent X column
          const myManager = contact.managerId;
          
          // Collect all nodes at similar depth or same parent for lane snapping
          contactNodesRef.current.forEach((otherData, otherId) => {
            if (otherId === contact.id) return;
            const otherCenter = otherData.group.getCenterPoint();
            
            // Peer lane: same manager → snap to same Y row
            if (myManager && otherData.contact.managerId === myManager) {
              if (Math.abs(center.y - otherCenter.y) < LANE_SNAP_THRESHOLD + 40) {
                snapY = otherCenter.y;
              }
            }
            
            // Vertical lane: snap X if close to another node's X (column alignment)
            if (Math.abs(center.x - otherCenter.x) < LANE_SNAP_THRESHOLD) {
              snapX = otherCenter.x;
            }
            
            // Horizontal lane: snap Y if close to same row
            if (Math.abs(center.y - otherCenter.y) < LANE_SNAP_THRESHOLD) {
              snapY = otherCenter.y;
            }
          });
          
          if (snapX !== null || snapY !== null) {
            node.set({
              left: snapX !== null ? snapX - NODE_W / 2 : node.left,
              top: snapY !== null ? snapY - NODE_H / 2 : node.top,
            });
            node.setCoords();
          }
        }
        
        // Capture snap target before clearing
        const currentSnapTarget = snapTargetRef.current;
        snapTargetRef.current = null;
        
        // If snapped to company root — only CEO can connect here
        if (currentSnapTarget === "__company_root__") {
          const isCeo = account.ceoContactId === contact.id;
          if (isCeo) {
            rebuildAllEdges(fabricCanvas, canvasW, true);
            if (companyNodeRef.current) pulseNode(fabricCanvas, companyNodeRef.current);
            onUnlinkFromManagerRef.current?.(contact.id);
          } else {
            toast("Only the CEO connects to the company root. Set this contact as CEO to link here.", {
              action: {
                label: "Set as CEO",
                onClick: () => onSetCeoRef.current?.(contact.id),
              },
              duration: 6000,
            });
            rebuildAllEdges(fabricCanvas, canvasW);
          }
        } else if (currentSnapTarget) {
          const targetData = contactNodesRef.current.get(currentSnapTarget);
          rebuildAllEdges(fabricCanvas, canvasW, true);
          if (targetData) pulseNode(fabricCanvas, targetData.group);
          onSnapEdgeCreateRef.current?.(contact.id, currentSnapTarget);
        } else {
          rebuildAllEdges(fabricCanvas, canvasW);
        }
        
        fabricCanvas.renderAll();
      });

      node.on('mouseover', function() {
        (this as FabricObject).set({ 
          shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
        });

        // ── Hierarchy hover highlighting ──
        // Build ancestor chain (manager chain upward)
        const ancestors = new Set<string>();
        let current = contact.id;
        while (parentMap.has(current)) {
          current = parentMap.get(current)!;
          ancestors.add(current);
        }

        // Build descendant set (direct reports downward)
        const descendants = new Set<string>();
        const collectDescendants = (id: string) => {
          const kids = childrenMap.get(id) || [];
          kids.forEach(kid => {
            descendants.add(kid);
            collectDescendants(kid);
          });
        };
        collectDescendants(contact.id);

        const related = new Set([contact.id, ...ancestors, ...descendants]);

        // Apply highlighting to all nodes
        contactNodesRef.current.forEach((otherData, otherId) => {
          const otherCardBg = otherData.group.getObjects()[0] as Rect;
          if (otherId === contact.id) return; // skip hovered node itself
          
          if (ancestors.has(otherId) || descendants.has(otherId)) {
            // Bold highlight related nodes
            otherData.group.set({ opacity: 1 });
          } else {
            // Fade unrelated nodes
            otherData.group.set({ opacity: 0.8 });
          }
        });

        // Bold hierarchy lines for related nodes
        hierarchyLinesRef.current.forEach(l => {
          l.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 });
        });
        fabricCanvas.renderAll();
      });

      node.on('mouseout', function() {
        (this as FabricObject).set({ shadow: null });

        // Reset all nodes to normal opacity
        contactNodesRef.current.forEach((otherData, otherId) => {
          otherData.group.set({ opacity: 1 });
        });

        // Reset hierarchy line styles to depth-based defaults (no full rebuild needed)
        hierarchyLinesRef.current.forEach(l => {
          // Restore default subtle style
          l.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 });
        });
        fabricCanvas.renderAll();
      });

      node.on('mousedown', () => {
        // Link mode: clicking any other node selects it as the manager target
        if (linkModeSourceIdRef.current && linkModeSourceIdRef.current !== contact.id) {
          onLinkModeSelectRef.current?.(contact.id);
          return;
        }
        if (interactionModeRef.current === 'edit') {
          // In edit mode: select node for structure editing
          onNodeSelectRef.current?.(contact.id);
        } else {
          // In browse mode: single click selects node (highlights it)
          onNodeSelectRef.current?.(contact.id);
        }
      });

      node.on('mousedblclick', () => {
        if (interactionModeRef.current === 'browse') {
          // In browse mode, double-click opens profile
          onContactClickRef.current(contact);
        }
        // In edit mode, double-click does nothing
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
        const steps = Math.max(1, Math.round(duration / 16));
        let step = 0;
        const initialOpacity = line.opacity ?? 1;
        // Retract: animate x2/y2 toward x1/y1
        const startX2 = line.x2!;
        const startY2 = line.y2!;
        const endX2 = line.x1!;
        const endY2 = line.y1!;
        const tick = () => {
          step++;
          const t = step / steps;
          line.set({
            opacity: initialOpacity * (1 - t),
            x2: startX2 + (endX2 - startX2) * t,
            y2: startY2 + (endY2 - startY2) * t,
          });
          line.setCoords();
          canvas.requestRenderAll();
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
        // Ease-out quad
        const eased = 1 - (1 - t) * (1 - t);
        line.set({
          x2: startX + (targetX2 - startX) * eased,
          y2: startY + (targetY2 - startY) * eased,
          opacity: eased,
        });
        line.setCoords();
        canvas.requestRenderAll();
        if (step < steps) requestAnimationFrame(tick);
        else {
          line.set({ opacity: 1 });
          canvas.requestRenderAll();
        }
      };
      requestAnimationFrame(tick);
    };

    const pulseNode = (canvas: FabricCanvas, group: Group) => {
      const steps = 20; // ~320ms
      let step = 0;
      const tick = () => {
        step++;
        const t = step / steps;
        // Pulse up then down
        const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
        group.set({
          shadow: { color: 'hsl(221 83% 53%)', blur: 10 + intensity * 20, offsetX: 0, offsetY: 0 },
        });
        canvas.requestRenderAll();
        if (step < steps) requestAnimationFrame(tick);
        else {
          group.set({ shadow: null });
          canvas.requestRenderAll();
        }
      };
      requestAnimationFrame(tick);
    };

    // ── Ephemeral edge rebuild: clears all hierarchy lines and redraws from manager_id ──
    // animated=true triggers transition animations (used after relationship changes)
    // CRITICAL: Always synchronously remove old lines first to prevent ghost artefacts.
    const rebuildAllEdges = (canvas: FabricCanvas, cw: number, animated: boolean = false) => {
      // Increment generation — any pending animated rebuild from a prior call is now stale
      const gen = ++edgeRebuildGenRef.current;

      // 1. Synchronously remove ALL old lines from canvas immediately
      const oldLines = [...hierarchyLinesRef.current];
      hierarchyLinesRef.current = [];
      oldLines.forEach(line => { try { canvas.remove(line); } catch {} });

      if (animated) {
        // Draw new edges with draw-in animation (no setTimeout — immediate but animated)
        drawFreshEdges(canvas, cw, true, gen);
      } else {
        drawFreshEdges(canvas, cw, false, gen);
      }
    };

    // Helper: create orthogonal edge (vertical down from parent, horizontal, vertical down to child)
    const createOrthogonalEdge = (
      canvas: FabricCanvas,
      x1: number, y1: number, // parent bottom anchor
      x2: number, y2: number, // child top anchor
      strokeColor: string,
      strokeWidth: number,
      animated: boolean,
    ) => {
      const midY = y1 + (y2 - y1) / 2;
      // Three segments: vertical down, horizontal across, vertical down
      const segments = [
        [x1, y1, x1, midY],
        [x1, midY, x2, midY],
        [x2, midY, x2, y2],
      ];
      segments.forEach(([sx1, sy1, sx2, sy2]) => {
        const line = new Line([sx1, sy1, sx2, sy2], {
          stroke: strokeColor,
          strokeWidth,
          selectable: false,
          evented: false,
        });
        canvas.add(line);
        canvas.sendObjectToBack(line);
        hierarchyLinesRef.current.push(line);
        if (animated) animateDrawIn(canvas, line, 200);
      });
    };

    const drawFreshEdges = (canvas: FabricCanvas, cw: number, animated: boolean, gen: number) => {
      // If a newer rebuild was triggered, abort this one
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

          // Use orthogonal routing if nodes are offset horizontally, straight line if aligned
          const px = parentCenter.x;
          const py = parentCenter.y + NODE_H / 2;
          const cx = childCenter.x;
          const cy = childCenter.y - NODE_H / 2;

          if (Math.abs(px - cx) < 4) {
            // Vertically aligned — single straight line
            const line = new Line([px, py, cx, cy], {
              stroke: `hsl(214 32% ${lightness}%)`,
              strokeWidth: baseStrokeWidth,
              selectable: false,
              evented: false,
            });
            canvas.add(line);
            canvas.sendObjectToBack(line);
            hierarchyLinesRef.current.push(line);
            if (animated) animateDrawIn(canvas, line, 200);
          } else {
            // Orthogonal L-shaped connector
            createOrthogonalEdge(canvas, px, py, cx, cy, `hsl(214 32% ${lightness}%)`, baseStrokeWidth, animated);
          }
        } else if (!contact.managerId && account.ceoContactId === childId) {
          // Root edge: company root to CEO
          const childCenter = childData.group.getCenterPoint();
          const px = cw / 2;
          const py = 120;
          const cx = childCenter.x;
          const cy = childCenter.y - NODE_H / 2;

          if (Math.abs(px - cx) < 4) {
            const line = new Line([px, py, cx, cy], {
              stroke: `hsl(214 32% 91%)`,
              strokeWidth: 3,
              selectable: false,
              evented: false,
            });
            canvas.add(line);
            canvas.sendObjectToBack(line);
            hierarchyLinesRef.current.push(line);
            if (animated) animateDrawIn(canvas, line, 200);
          } else {
            createOrthogonalEdge(canvas, px, py, cx, cy, `hsl(214 32% 91%)`, 3, animated);
          }
        }
      });
    };

    // ── Place executives row (C-suite) ──
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
        wireContactNode(contact, node, x, y, depthMap.get(contact.id) || 0);
      });
    }

    // ── Place department columns ──
    const deptCount = layout.departments.length;
    if (deptCount > 0) {
      const deptTotalW = deptCount * NODE_W + (deptCount - 1) * (HORIZONTAL_GAP * 2);
      const deptStartX = canvasW / 2 - deptTotalW / 2 + NODE_W / 2;

      layout.departments.forEach((dept, deptIdx) => {
        const deptX = deptStartX + deptIdx * (NODE_W + HORIZONTAL_GAP * 2);

        // Department label
        const deptLabel = new Text(dept.name, {
          fontSize: 11,
          fontWeight: "bold",
          fill: "hsl(215 16% 47%)",
          left: deptX,
          top: DEPT_START_Y - 10,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        fabricCanvas.add(deptLabel);

        dept.nodes.forEach((orgNode, nodeIdx) => {
          const y = DEPT_START_Y + DEPT_HEADER_H + nodeIdx * (NODE_H + VERTICAL_GAP);
          const contact = contactMap.get(orgNode.contactId);
          if (!contact) return;

          const node = createContactNode(contact, deptX, y);
          wireContactNode(contact, node, deptX, y, depthMap.get(contact.id) || 0);
        });
      });
    }

    // ── Draw initial edges from manager_id (ephemeral) ──
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

  // Effect: Link Mode visual highlighting + preview line + Escape key
  useEffect(() => {
    if (!fabricCanvas) return;

    // Clean up preview line when link mode ends
    if (!linkModeSourceId) {
      if (linkPreviewLineRef.current) {
        try { fabricCanvas.remove(linkPreviewLineRef.current); } catch {}
        linkPreviewLineRef.current = null;
      }
      // Reset all node opacities
      contactNodesRef.current.forEach((nodeData) => {
        const cardBg = nodeData.group.getObjects()[0] as Rect;
        nodeData.group.set({ opacity: 1 });
        cardBg.set({ stroke: "hsl(214 32% 91%)", strokeWidth: 1 });
      });
      fabricCanvas.renderAll();
      return;
    }

    // Highlight potential targets, dim the source node
    contactNodesRef.current.forEach((nodeData, id) => {
      const cardBg = nodeData.group.getObjects()[0] as Rect;
      if (id === linkModeSourceId) {
        // Source node: blue border, slightly dimmed
        cardBg.set({ stroke: "hsl(221 83% 53%)", strokeWidth: 3 });
        nodeData.group.set({ opacity: 0.7 });
      } else {
        // Potential target: subtle green glow to indicate clickable
        cardBg.set({ stroke: "hsl(142 71% 45%)", strokeWidth: 2 });
        nodeData.group.set({ opacity: 1 });
        nodeData.group.set({
          shadow: { color: 'hsl(142 71% 45%)', blur: 8, offsetX: 0, offsetY: 0 },
        });
      }
    });
    fabricCanvas.renderAll();

    // Mouse move handler for preview line
    const handleMouseMove = (opt: any) => {
      if (!linkModeSourceIdRef.current) return;
      const sourceData = contactNodesRef.current.get(linkModeSourceIdRef.current);
      if (!sourceData) return;

      const pointer = fabricCanvas.getScenePoint(opt.e);
      const sourceCenter = sourceData.group.getCenterPoint();

      if (linkPreviewLineRef.current) {
        try { fabricCanvas.remove(linkPreviewLineRef.current); } catch {}
      }

      const previewLine = new Line(
        [sourceCenter.x, sourceCenter.y - 45, pointer.x, pointer.y],
        {
          stroke: "hsl(221 83% 53%)",
          strokeWidth: 2,
          strokeDashArray: [8, 4],
          selectable: false,
          evented: false,
          opacity: 0.6,
        }
      );
      fabricCanvas.add(previewLine);
      linkPreviewLineRef.current = previewLine;
      fabricCanvas.renderAll();
    };

    fabricCanvas.on('mouse:move', handleMouseMove);

    // Escape key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onLinkModeCancelRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      fabricCanvas.off('mouse:move', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up preview line
      if (linkPreviewLineRef.current) {
        try { fabricCanvas.remove(linkPreviewLineRef.current); } catch {}
        linkPreviewLineRef.current = null;
      }
      // Reset node shadows
      contactNodesRef.current.forEach((nodeData) => {
        nodeData.group.set({ shadow: null });
      });
      fabricCanvas.renderAll();
    };
  }, [fabricCanvas, linkModeSourceId]);

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
    selectable: true,
    hasControls: false,
    hasBorders: false,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
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
