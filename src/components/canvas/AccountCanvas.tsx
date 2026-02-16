import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { User, Users } from "lucide-react";
import { computeTreeLayout, computeUnlinkedPositions, CARD_W, CARD_H, GAP_X, GAP_Y, COMPANY_Y, ROOT_Y } from "@/lib/tree-layout";
import { supabase } from "@/integrations/supabase/client";

import { DropZone } from "@/hooks/use-org-chart-edges";

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
  onDropZone?: (draggedContactId: string, targetContactId: string | null, zone: DropZone) => void;
  workspaceId?: string;
  // Org chart edges as single source of truth
  edgeParentMap?: Map<string, string | null>;
  edgeChildrenMap?: Map<string, string[]>;
  rootContactId?: string | null;
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
  onDropZone,
  workspaceId,
  edgeParentMap = new Map(),
  edgeChildrenMap = new Map(),
  rootContactId = null,
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
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);
  useEffect(() => { onContactClickRef.current = onContactClick; }, [onContactClick]);
  const companyNodeRef = useRef<Group | null>(null);
  const isCanvasDisposedRef = useRef(false);
  const hierarchyLinesRef = useRef<Line[]>([]);
  
  // Ghost-line prevention: generation counter invalidates stale async edge rebuilds
  const edgeRebuildGenRef = useRef(0);
  // Store previous node positions for smooth animation between layout changes
  const previousPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Active animation frame ID for cleanup
  const animationFrameRef = useRef<number | null>(null);
  
  // Smart snap system refs
  const guideLinesToRef = useRef<Line[]>([]);
  const snapHighlightRef = useRef<Rect | null>(null);
  const dropZoneIndicatorsRef = useRef<Rect[]>([]);
  const activeDropZoneRef = useRef<{ targetId: string | null; zone: DropZone } | null>(null);
  const autoPanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDropZoneRef = useRef(onDropZone);
  useEffect(() => { onDropZoneRef.current = onDropZone; }, [onDropZone]);
  
  // Snap constants
  const AUTO_PAN_EDGE = 60;
  const AUTO_PAN_SPEED = 8;
  const COMPANY_SNAP_RADIUS = 80;
  const DROP_ZONE_PROXIMITY = 120; // px - only show zones when pointer is within this distance

  // Guide line & drop zone management
  const clearGuideLines = useCallback((canvas: FabricCanvas) => {
    guideLinesToRef.current.forEach(line => {
      try { canvas.remove(line); } catch {}
    });
    guideLinesToRef.current = [];
    if (snapHighlightRef.current) {
      try { canvas.remove(snapHighlightRef.current); } catch {}
      snapHighlightRef.current = null;
    }
    dropZoneIndicatorsRef.current.forEach(r => {
      try { canvas.remove(r); } catch {}
    });
    dropZoneIndicatorsRef.current = [];
    activeDropZoneRef.current = null;
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

  /**
   * Determine which drop zone the pointer is in relative to a target card.
   * Simplified to 3 zones: LEFT (sibling before), RIGHT (sibling after), CENTER (child).
   * Left 30% = left, Right 30% = right, Center 40% = child (drop onto).
   */
  const detectDropZone = useCallback((
    pointerX: number,
    pointerY: number,
    targetCenterX: number,
    targetCenterY: number,
    nodeW: number,
    nodeH: number,
  ): DropZone | null => {
    const left = targetCenterX - nodeW / 2;
    const top = targetCenterY - nodeH / 2;
    const relX = pointerX - left;
    const relY = pointerY - top;

    // Out of bounds
    if (relX < 0 || relX > nodeW || relY < 0 || relY > nodeH) return null;

    const fracX = relX / nodeW;

    // Left 30% = sibling before, Right 30% = sibling after, Center = child
    if (fracX < 0.3) return "left";
    if (fracX > 0.7) return "right";

    return "bottom"; // center = become child of target
  }, []);

  const showDropZoneIndicator = useCallback((canvas: FabricCanvas, targetGroup: Group, zone: DropZone) => {
    // Clear old indicators
    dropZoneIndicatorsRef.current.forEach(r => {
      try { canvas.remove(r); } catch {}
    });
    dropZoneIndicatorsRef.current = [];

    const cx = targetGroup.left!;
    const cy = targetGroup.top!;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;

    const zoneColors: Record<DropZone, string> = {
      top: "hsl(221 83% 53%)",
      bottom: "hsl(221 83% 53%)", // blue - insert as child
      left: "hsl(221 83% 53%)",   // blue - sibling before
      right: "hsl(221 83% 53%)",  // blue - sibling after
      company_root: "hsl(221 83% 53%)",
    };

    const color = zoneColors[zone];
    let indicator: Rect;

    switch (zone) {
      case "bottom":
        // Highlight entire card for "become child" drop
        indicator = new Rect({
          left: cx - hw - 2, top: cy - hh - 2,
          width: CARD_W + 4, height: CARD_H + 4,
          fill: "transparent", stroke: color, strokeWidth: 3,
          rx: 10, ry: 10,
          selectable: false, evented: false, opacity: 0.8,
        });
        break;
      case "left":
        indicator = new Rect({
          left: cx - hw - 8, top: cy - hh,
          width: 6, height: CARD_H,
          fill: color, rx: 3, ry: 3,
          selectable: false, evented: false, opacity: 0.8,
        });
        break;
      case "right":
        indicator = new Rect({
          left: cx + hw + 2, top: cy - hh,
          width: 6, height: CARD_H,
          fill: color, rx: 3, ry: 3,
          selectable: false, evented: false, opacity: 0.8,
        });
        break;
      default:
        return;
    }

    canvas.add(indicator);
    dropZoneIndicatorsRef.current.push(indicator);

    // Also add a highlight border around target
    if (snapHighlightRef.current) {
      try { canvas.remove(snapHighlightRef.current); } catch {}
    }
    const highlight = new Rect({
      left: cx - hw - 4,
      top: cy - hh - 4,
      width: CARD_W + 8,
      height: CARD_H + 8,
      fill: "transparent",
      stroke: color,
      strokeWidth: 2,
      strokeDashArray: [6, 3],
      rx: 10, ry: 10,
      selectable: false, evented: false, opacity: 0.6,
    });
    canvas.add(highlight);
    snapHighlightRef.current = highlight;
  }, []);

  // Auto-pan when near edges
  const startAutoPan = useCallback((canvas: FabricCanvas, mouseX: number, mouseY: number) => {
    if (autoPanIntervalRef.current) clearInterval(autoPanIntervalRef.current);
    
    const cw = canvas.width!;
    const ch = canvas.height!;
    let dx = 0, dy = 0;
    
    if (mouseX < AUTO_PAN_EDGE) dx = AUTO_PAN_SPEED;
    else if (mouseX > cw - AUTO_PAN_EDGE) dx = -AUTO_PAN_SPEED;
    if (mouseY < AUTO_PAN_EDGE) dy = AUTO_PAN_SPEED;
    else if (mouseY > ch - AUTO_PAN_EDGE) dy = -AUTO_PAN_SPEED;
    
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
      canvas.requestRenderAll();
    }, 16);
  }, []);
  
  const stopAutoPan = useCallback(() => {
    if (autoPanIntervalRef.current) {
      clearInterval(autoPanIntervalRef.current);
      autoPanIntervalRef.current = null;
    }
  }, []);
  
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !account || isCanvasDisposedRef.current) return;

    try {
      fabricCanvas.clear();
    } catch (e) {
      // Canvas context already disposed during unmount race
      return;
    }
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();
    hierarchyLinesRef.current = [];

    const canvasW = fabricCanvas.width!;

    // ── Layout constants (from tree-layout module) ──
    const NODE_W = CARD_W;
    const NODE_H = CARD_H;

    // ── Company node at top ──
    const companyNode = createCompanyNode(account.name, canvasW / 2, COMPANY_Y);
    
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

    // ── Contact lookup map ──
    const contactMap = new Map<string, Contact>();
    account.contacts.forEach(c => contactMap.set(c.id, c));

    const parentMap = edgeParentMap;
    const childrenMap = edgeChildrenMap;
    const depthMap = new Map<string, number>();

    // Compute depth for each contact from edge maps
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

    const wireContactNode = (contact: Contact, node: Group, x: number, y: number, depth: number = 0) => {
      depthMap.set(contact.id, depth);

      node.on('moving', function(opt) {
        // Only allow movement in edit mode
        if (interactionModeRef.current !== 'edit') {
          node.set({ left: x, top: y });
          node.setCoords();
          return;
        }
        const center = node.getCenterPoint();
        // Rebuild all edges from scratch on every move (ephemeral edges)
        rebuildAllEdges(fabricCanvas, canvasW);
        
        // ── 4-Zone Drop Detection ──
        clearGuideLines(fabricCanvas);
        
        const dragX = center.x;
        const dragY = center.y;
        
        // 1. Check company node for root snap
        let foundDropZone = false;
        if (companyNodeRef.current) {
          const companyCenter = companyNodeRef.current.getCenterPoint();
          const distToCompany = Math.sqrt(
            Math.pow(dragX - companyCenter.x, 2) + Math.pow(dragY - companyCenter.y, 2)
          );
          if (distToCompany < COMPANY_SNAP_RADIUS) {
            // Show company root indicator
            if (snapHighlightRef.current) {
              try { fabricCanvas.remove(snapHighlightRef.current); } catch {}
            }
            const highlight = new Rect({
              left: companyCenter.x - 50,
              top: companyCenter.y - 50,
              width: 100, height: 100,
              fill: "transparent",
              stroke: "hsl(221 83% 53%)",
              strokeWidth: 3, rx: 50, ry: 50,
              selectable: false, evented: false, opacity: 0.6,
            });
            fabricCanvas.add(highlight);
            snapHighlightRef.current = highlight;
            addGuideLine(fabricCanvas, companyCenter.x, companyCenter.y + 40, dragX, dragY - NODE_H / 2);
            activeDropZoneRef.current = { targetId: null, zone: "company_root" };
            foundDropZone = true;
          }
        }
        
        // 2. Check all other contact nodes for 4-zone detection
        if (!foundDropZone) {
          let bestTarget: { id: string; group: Group; zone: DropZone; dist: number } | null = null;
          
          contactNodesRef.current.forEach((otherData, otherId) => {
            if (otherId === contact.id) return;
            const otherCenter = otherData.group.getCenterPoint();
            const dist = Math.sqrt(
              Math.pow(dragX - otherCenter.x, 2) + Math.pow(dragY - otherCenter.y, 2)
            );
            
            // Only check zones if pointer is close enough to the card
            if (dist > DROP_ZONE_PROXIMITY) return;
            
            const zone = detectDropZone(dragX, dragY, otherCenter.x, otherCenter.y, NODE_W, NODE_H);
            if (zone && (!bestTarget || dist < bestTarget.dist)) {
              bestTarget = { id: otherId, group: otherData.group, zone, dist };
            }
          });
          
          if (bestTarget) {
            showDropZoneIndicator(fabricCanvas, bestTarget.group, bestTarget.zone);
            activeDropZoneRef.current = { targetId: bestTarget.id, zone: bestTarget.zone };
            
            // Draw guide line based on zone type
            const tc = bestTarget.group.getCenterPoint();
            switch (bestTarget.zone) {
              case "bottom":
                // Draw line from target bottom to dragged top (child relationship)
                addGuideLine(fabricCanvas, tc.x, tc.y + NODE_H / 2, dragX, dragY - NODE_H / 2);
                break;
              case "left":
                addGuideLine(fabricCanvas, tc.x - NODE_W / 2 - 10, tc.y, dragX + NODE_W / 2, dragY);
                break;
              case "right":
                addGuideLine(fabricCanvas, tc.x + NODE_W / 2 + 10, tc.y, dragX - NODE_W / 2, dragY);
                break;
            }
          }
        }
        
        // Auto-pan near edges
        if (opt.e) {
          const evt = opt.e as MouseEvent;
          startAutoPan(fabricCanvas, evt.offsetX, evt.offsetY);
        }
        
        fabricCanvas.renderAll();
      });
      
      // On drop: fire the appropriate drop zone action
      node.on('modified', function() {
        stopAutoPan();
        const dropInfo = activeDropZoneRef.current;
        clearGuideLines(fabricCanvas);
        
        if (interactionModeRef.current !== 'edit') {
          // Snap back to original position
          const origPos = contactNodesRef.current.get(contact.id)?.originalPosition;
          if (origPos) {
            node.set({ left: origPos.x, top: origPos.y });
            node.setCoords();
          }
          rebuildAllEdges(fabricCanvas, canvasW);
          fabricCanvas.renderAll();
          return;
        }
        
        if (dropInfo) {
          // Pulse the target node
          if (dropInfo.targetId) {
            const targetData = contactNodesRef.current.get(dropInfo.targetId);
            if (targetData) pulseNode(fabricCanvas, targetData.group);
          } else if (companyNodeRef.current) {
            pulseNode(fabricCanvas, companyNodeRef.current);
          }
          
          // Fire the callback (will trigger edge data change → layout recompute → animation)
          onDropZoneRef.current?.(contact.id, dropInfo.targetId, dropInfo.zone);
        } else {
          // No valid drop zone: snap back to original position
          const origPos = contactNodesRef.current.get(contact.id)?.originalPosition;
          if (origPos) {
            node.set({ left: origPos.x, top: origPos.y });
            node.setCoords();
          }
        }
        
        // Always rebuild edges after drop to clear any artifacts
        rebuildAllEdges(fabricCanvas, canvasW);
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

        // Blue highlight hierarchy lines for related nodes
        hierarchyLinesRef.current.forEach(l => {
          l.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 });
        });
        fabricCanvas.renderAll();
      });

      node.on('mouseout', function() {
        // Don't clear selection highlight in edit mode
        if (interactionModeRef.current === 'edit' && selectedNodeIdRef.current === contact.id) {
          (this as FabricObject).set({ shadow: null });
        } else {
          (this as FabricObject).set({ shadow: null });
        }

        // Reset all nodes to normal
        contactNodesRef.current.forEach((otherData, otherId) => {
          otherData.group.set({ opacity: 1 });
        });

        // Reset all hierarchy lines to depth-based defaults
        rebuildAllEdges(fabricCanvas, canvasW);
        fabricCanvas.renderAll();
      });

      node.on('mousedown', () => {
        if (interactionModeRef.current === 'edit') {
          // In edit mode: select node, don't open profile
          onNodeSelectRef.current?.(contact.id);
        } else {
          // In browse mode: open profile (existing behavior)
          onContactClickRef.current(contact);
        }
      });

      node.on('mousedblclick', () => {
        if (interactionModeRef.current === 'edit') {
          // In edit mode, double-click opens profile
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
    const rebuildAllEdges = (canvas: FabricCanvas, cw: number, animated: boolean = false) => {
      // Increment generation to invalidate any in-flight async rebuilds
      const gen = ++edgeRebuildGenRef.current;
      
      // Synchronous purge: remove ALL old lines immediately (ghost-line prevention)
      const oldLines = [...hierarchyLinesRef.current];
      hierarchyLinesRef.current = [];
      oldLines.forEach(line => { try { canvas.remove(line); } catch {} });

      // Draw fresh edges; if animated, use draw-in animation
      drawFreshEdges(canvas, cw, animated, gen);
    };

    const drawFreshEdges = (canvas: FabricCanvas, cw: number, animated: boolean, gen?: number) => {
      // If a newer generation has started, bail out (ghost-line prevention)
      if (gen !== undefined && gen !== edgeRebuildGenRef.current) return;

      const BLUE = "hsl(221 83% 53%)";
      const BLUE_LIGHT = "hsl(221 83% 70%)";

      // Draw vertical parent→child edges (blue)
      contactNodesRef.current.forEach((childData, childId) => {
        const parentId = parentMap.get(childId);
        if (parentId && contactNodesRef.current.has(parentId)) {
          const parentData = contactNodesRef.current.get(parentId)!;
          const parentCenter = parentData.group.getCenterPoint();
          const childCenter = childData.group.getCenterPoint();
          const line = new Line([parentCenter.x, parentCenter.y + NODE_H / 2, childCenter.x, childCenter.y - NODE_H / 2], {
            stroke: BLUE,
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          canvas.sendObjectToBack(line);
          hierarchyLinesRef.current.push(line);
          if (animated) animateDrawIn(canvas, line, 200);
        } else if (parentId === null || parentId === undefined) {
          // Root node → draw line from company icon
          if (childId === rootContactId) {
            const childCenter = childData.group.getCenterPoint();
            const line = new Line([cw / 2, COMPANY_Y + 40, childCenter.x, childCenter.y - NODE_H / 2], {
              stroke: BLUE,
              strokeWidth: 3,
              selectable: false,
              evented: false,
            });
            canvas.add(line);
            canvas.sendObjectToBack(line);
            hierarchyLinesRef.current.push(line);
            if (animated) animateDrawIn(canvas, line, 200);
          }
        }
      });

      // Draw horizontal sibling connectors (blue, lighter)
      childrenMap.forEach((siblings) => {
        if (siblings.length < 2) return;
        for (let i = 0; i < siblings.length - 1; i++) {
          const leftData = contactNodesRef.current.get(siblings[i]);
          const rightData = contactNodesRef.current.get(siblings[i + 1]);
          if (!leftData || !rightData) continue;
          const leftCenter = leftData.group.getCenterPoint();
          const rightCenter = rightData.group.getCenterPoint();
          const line = new Line([
            leftCenter.x + NODE_W / 2, leftCenter.y,
            rightCenter.x - NODE_W / 2, rightCenter.y,
          ], {
            stroke: BLUE_LIGHT,
            strokeWidth: 1.5,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          canvas.sendObjectToBack(line);
          hierarchyLinesRef.current.push(line);
          if (animated) animateDrawIn(canvas, line, 200);
        }
      });
    };

    // ── Compute deterministic tree positions from org_chart_edges ──
    const treePositions = computeTreeLayout(rootContactId, childrenMap, canvasW / 2);

    // Find contacts not in the tree (no edge row)
    const allContactIds = new Set(account.contacts.map(c => c.id));
    const inTree = new Set(treePositions.keys());
    const unlinkedIds = account.contacts.filter(c => !inTree.has(c.id)).map(c => c.id);
    const unlinkedPositions = computeUnlinkedPositions(unlinkedIds, treePositions, canvasW / 2);

    // Merge all positions
    const allPositions = new Map([...treePositions, ...unlinkedPositions]);

    // Capture old positions for animation
    const oldPositions = previousPositionsRef.current;
    const newPositions = new Map<string, { x: number; y: number }>();

    // ── Place all contacts using computed positions ──
    allPositions.forEach((pos, contactId) => {
      const contact = contactMap.get(contactId);
      if (!contact) return;
      
      // Start at old position if available, otherwise at final position
      const startPos = oldPositions.get(contactId) || { x: pos.x, y: pos.y };
      const node = createContactNode(contact, startPos.x, startPos.y);
      wireContactNode(contact, node, startPos.x, startPos.y, pos.depth >= 0 ? pos.depth : 0);
      newPositions.set(contactId, { x: pos.x, y: pos.y });
    });

    // Save new positions for next re-render
    previousPositionsRef.current = newPositions;

    // ── Animate nodes from old to new positions (200ms ease-out) ──
    const hasOldPositions = oldPositions.size > 0;
    if (hasOldPositions) {
      // Cancel any running animation
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      const ANIM_DURATION = 200; // ms
      const startTime = performance.now();

      const animateNodes = (now: number) => {
        if (isCanvasDisposedRef.current) return;
        const elapsed = now - startTime;
        const rawT = Math.min(elapsed / ANIM_DURATION, 1);
        // Ease-out quad
        const t = 1 - (1 - rawT) * (1 - rawT);

        contactNodesRef.current.forEach((nodeData, contactId) => {
          const oldPos = oldPositions.get(contactId);
          const newPos = newPositions.get(contactId);
          if (!oldPos || !newPos) return;
          if (oldPos.x === newPos.x && oldPos.y === newPos.y) return;

          const currentX = oldPos.x + (newPos.x - oldPos.x) * t;
          const currentY = oldPos.y + (newPos.y - oldPos.y) * t;
          nodeData.group.set({ left: currentX, top: currentY });
          nodeData.group.setCoords();
        });

        // Rebuild edges each frame during animation (attach to moving nodes)
        rebuildAllEdges(fabricCanvas, canvasW);
        fabricCanvas.requestRenderAll();

        if (rawT < 1) {
          animationFrameRef.current = requestAnimationFrame(animateNodes);
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateNodes);
    } else {
      // No animation needed — first render or no previous positions
      rebuildAllEdges(fabricCanvas, canvasW);
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas, account, edgeParentMap, edgeChildrenMap, rootContactId]);

  // Effect: highlight selected node and its edges in edit mode
  useEffect(() => {
    if (!fabricCanvas) return;

    contactNodesRef.current.forEach((nodeData, id) => {
      const { group } = nodeData;
      const cardBg = group.getObjects()[0] as Rect;

      if (interactionMode === "edit") {
        // In edit mode, all contacts get a blue glow
        group.set({
          shadow: { color: 'hsl(221 83% 53%)', blur: 12, offsetX: 0, offsetY: 0 },
        });
        if (selectedNodeId === id) {
          cardBg.set({ stroke: "hsl(221 83% 53%)", strokeWidth: 3 });
          group.set({ opacity: 1 });
        } else {
          cardBg.set({ stroke: "hsl(221 70% 80%)", strokeWidth: 1.5 });
          group.set({ opacity: 1 });
        }
      } else {
        // Browse mode: no glow
        group.set({ shadow: null });
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
