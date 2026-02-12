import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact, Talent, TalentEngagement, EngagementStatus } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { User, Users } from "lucide-react";
import { buildOrgChartLayout, SENIORITY_LABELS } from "@/lib/seniority-inference";

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
}

export interface AccountCanvasRef {
  clearSearch: () => void;
  highlightContacts: (contactIds: string[]) => void;
}

interface ContactNodeData {
  contact: Contact;
  group: Group;
  originalStroke?: string | null;
  originalStrokeWidth?: number;
  lines: Line[];
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
  const companyNodeRef = useRef<Group | null>(null);
  const isCanvasDisposedRef = useRef(false);
  
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

    const allLines: Line[] = [];
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

    const wireContactNode = (contact: Contact, node: Group, x: number, y: number, parentLine?: Line) => {
      const nodeLines: Line[] = parentLine ? [parentLine] : [];

      node.on('moving', function() {
        const center = node.getCenterPoint();
        nodeLines.forEach(line => {
          line.set({ x2: center.x, y2: center.y - NODE_H / 2 });
          line.setCoords();
        });
        // Also update any child lines that start from this node
        allLines.forEach(line => {
          if (line.get('x1') === x && line.get('y1') === y + NODE_H / 2) {
            line.set({ x1: center.x, y1: center.y + NODE_H / 2 });
            line.setCoords();
          }
        });
      });

      node.on('mouseover', function() {
        (this as FabricObject).set({ 
          shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
        });
        nodeLines.forEach(l => l.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 }));
        fabricCanvas.renderAll();
      });

      node.on('mouseout', function() {
        (this as FabricObject).set({ shadow: null });
        nodeLines.forEach(l => l.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 }));
        fabricCanvas.renderAll();
      });

      node.on('mousedown', () => onContactClick(contact));

      node.on('mousedblclick', () => {
        const center = node.getCenterPoint();
        fabricCanvas.setZoom(1.5);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = canvasW / 2 - center.x * 1.5;
        vpt[5] = fabricCanvas.height! / 2 - center.y * 1.5;
        fabricCanvas.renderAll();
      });

      fabricCanvas.add(node);

      contactNodesRef.current.set(contact.id, {
        contact,
        group: node,
        lines: nodeLines,
        anchorPoints: [
          new Point(x, y - NODE_H / 2),
          new Point(x - NODE_W / 2, y),
          new Point(x + NODE_W / 2, y),
          new Point(x, y + NODE_H / 2),
        ],
        originalPosition: { x, y },
      });
    };

    // ── Draw connecting line ──
    const drawLine = (x1: number, y1: number, x2: number, y2: number): Line => {
      const line = new Line([x1, y1, x2, y2], {
        stroke: "hsl(214 32% 91%)",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(line);
      fabricCanvas.sendObjectToBack(line);
      allLines.push(line);
      return line;
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

        // Line from company to exec
        const line = drawLine(canvasW / 2, 120, x, y - NODE_H / 2);
        const node = createContactNode(contact, x, y);
        wireContactNode(contact, node, x, y, line);
      });
    }

    // ── Place department columns ──
    const deptCount = layout.departments.length;
    if (deptCount > 0) {
      // Calculate department column widths
      const maxNodesPerDept = layout.departments.map(d => d.nodes.length);
      const deptTotalW = deptCount * NODE_W + (deptCount - 1) * (HORIZONTAL_GAP * 2);
      const deptStartX = canvasW / 2 - deptTotalW / 2 + NODE_W / 2;

      // Draw a horizontal connector bar from execs to departments
      if (execCount > 0 && deptCount > 1) {
        const barY = DEPT_START_Y - VERTICAL_GAP / 2 - 10;
        const firstDeptX = deptStartX;
        const lastDeptX = deptStartX + (deptCount - 1) * (NODE_W + HORIZONTAL_GAP * 2);
        drawLine(firstDeptX, barY, lastDeptX, barY);

        // Vertical line from exec center down to bar
        drawLine(canvasW / 2, EXEC_ROW_Y + NODE_H / 2, canvasW / 2, barY);
      }

      layout.departments.forEach((dept, deptIdx) => {
        const deptX = deptStartX + deptIdx * (NODE_W + HORIZONTAL_GAP * 2);
        const barY = DEPT_START_Y - VERTICAL_GAP / 2 - 10;

        // Vertical line from bar down to first node
        if (execCount > 0) {
          drawLine(deptX, barY, deptX, DEPT_START_Y + DEPT_HEADER_H - NODE_H / 2);
        } else {
          // No execs – line from company directly
          drawLine(canvasW / 2, 120, deptX, DEPT_START_Y + DEPT_HEADER_H - NODE_H / 2);
        }

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

        // Place each node in the department column
        dept.nodes.forEach((orgNode, nodeIdx) => {
          const y = DEPT_START_Y + DEPT_HEADER_H + nodeIdx * (NODE_H + VERTICAL_GAP);
          const contact = contactMap.get(orgNode.contactId);
          if (!contact) return;

          // Line from previous node or dept header
          let parentLine: Line | undefined;
          if (nodeIdx === 0) {
            // already drawn above
          } else {
            const prevY = DEPT_START_Y + DEPT_HEADER_H + (nodeIdx - 1) * (NODE_H + VERTICAL_GAP);
            parentLine = drawLine(deptX, prevY + NODE_H / 2, deptX, y - NODE_H / 2);
          }

          const node = createContactNode(contact, deptX, y);
          wireContactNode(contact, node, deptX, y, parentLine);
        });
      });
    }

    // If no contacts at all, just render company
    fabricCanvas.renderAll();
  }, [fabricCanvas, account, onContactClick]);

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

  const text = new Text(name, {
    fontSize: 13,
    fontWeight: "bold",
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
    top: 45,
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
