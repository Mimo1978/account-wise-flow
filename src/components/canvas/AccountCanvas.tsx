import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point, Rect } from "fabric";
import { Account, Contact } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
import { CanvasMinimap } from "./CanvasMinimap";
import { CompanyInfoPopover } from "./CompanyInfoPopover";
import { User, Users } from "lucide-react";

interface AccountCanvasProps {
  account: Account;
  onContactClick: (contact: Contact) => void;
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

export const AccountCanvas = ({ account, onContactClick }: AccountCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedNodes, setMatchedNodes] = useState<ContactNodeData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contactNodesRef = useRef<Map<string, ContactNodeData>>(new Map());
  const [showCompanyHover, setShowCompanyHover] = useState(false);
  const [companyHoverPosition, setCompanyHoverPosition] = useState({ x: 0, y: 0 });
  const companyNodeRef = useRef<Group | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

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
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !account) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "hsl(210 40% 98%)";
    contactNodesRef.current.clear();

    const allLines: Line[] = [];

    // Render company node at top center
    const companyNode = createCompanyNode(account.name, fabricCanvas.width! / 2, 80);
    
    // Add hover effects to company node
    companyNode.on('mouseover', function() {
      (this as FabricObject).set({ 
        shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 4 }
      });
      fabricCanvas.renderAll();
      setShowCompanyHover(true);
    });

    companyNode.on('mouseout', function() {
      (this as FabricObject).set({ shadow: null });
      fabricCanvas.renderAll();
      setShowCompanyHover(false);
    });

    companyNode.on('mousedown', () => {
      // TODO: Open full company profile panel
      console.log('Open company profile panel');
    });

    companyNodeRef.current = companyNode;
    fabricCanvas.add(companyNode);

    // Find CEO (assuming CEO is in contacts)
    const ceo = account.contacts.find(c => c.title.toLowerCase().includes('ceo'));
    let ceoY = 200;
    
    if (ceo) {
      const ceoNode = createContactNode(ceo, fabricCanvas.width! / 2, ceoY);
      
      // Calculate anchor points for CEO
      const ceoAnchorPoints = [
        new Point(fabricCanvas.width! / 2, ceoY - 50),
        new Point(fabricCanvas.width! / 2 - 90, ceoY),
        new Point(fabricCanvas.width! / 2 + 90, ceoY),
        new Point(fabricCanvas.width! / 2, ceoY + 50),
      ];

      const ceoLines: Line[] = [];

      // Draw line from company to CEO
      const ceoLine = new Line([fabricCanvas.width! / 2, 120, fabricCanvas.width! / 2, ceoY - 50], {
        stroke: "hsl(214 32% 91%)",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(ceoLine);
      fabricCanvas.sendObjectToBack(ceoLine);
      allLines.push(ceoLine);
      ceoLines.push(ceoLine);

      // Make CEO node draggable with dynamic line updates
      ceoNode.on('moving', function() {
        const center = ceoNode.getCenterPoint();
        ceoLines.forEach((line) => {
          line.set({ x2: center.x, y2: center.y - 50 });
          line.setCoords();
        });
      });

      // Hover effect
      ceoNode.on('mouseover', function() {
        (this as FabricObject).set({ 
          shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
        });
        ceoLines.forEach(line => line.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 }));
        fabricCanvas.renderAll();
      });

      ceoNode.on('mouseout', function() {
        (this as FabricObject).set({ shadow: null });
        ceoLines.forEach(line => line.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 }));
        fabricCanvas.renderAll();
      });

      ceoNode.on('mousedown', () => {
        onContactClick(ceo);
      });

      ceoNode.on('mousedblclick', () => {
        const center = ceoNode.getCenterPoint();
        fabricCanvas.setZoom(1.5);
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] = fabricCanvas.width! / 2 - center.x * 1.5;
        vpt[5] = fabricCanvas.height! / 2 - center.y * 1.5;
        fabricCanvas.renderAll();
      });

      fabricCanvas.add(ceoNode);

      contactNodesRef.current.set(ceo.id, {
        contact: ceo,
        group: ceoNode,
        lines: ceoLines,
        anchorPoints: ceoAnchorPoints,
        originalPosition: { x: fabricCanvas.width! / 2, y: ceoY },
      });
    }

    // Group other contacts by department (excluding CEO)
    const otherContacts = account.contacts.filter(c => !c.title.toLowerCase().includes('ceo'));
    const departments = Array.from(new Set(otherContacts.map(c => c.department)));
    const depWidth = fabricCanvas.width! / (departments.length + 1);
    const startY = 350;

    departments.forEach((dept, deptIdx) => {
      const deptContacts = otherContacts.filter(c => c.department === dept);
      const deptX = depWidth * (deptIdx + 1);

      // Render contacts in this department
      deptContacts.forEach((contact, idx) => {
        const contactY = startY + idx * 140;
        const contactNode = createContactNode(contact, deptX, contactY);
        
        // Calculate anchor points
        const anchorPoints = [
          new Point(deptX, contactY - 50),
          new Point(deptX - 90, contactY),
          new Point(deptX + 90, contactY),
          new Point(deptX, contactY + 50),
        ];

        const nodeLines: Line[] = [];

        // Draw line from CEO to first contact in each dept
        if (idx === 0) {
          const line = new Line([fabricCanvas.width! / 2, ceoY + 50, deptX, contactY - 50], {
            stroke: "hsl(214 32% 91%)",
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
          fabricCanvas.sendObjectToBack(line);
          allLines.push(line);
          nodeLines.push(line);
        }

        // Draw lines between contacts in same dept
        if (idx > 0) {
          const prevY = startY + (idx - 1) * 140;
          const line = new Line([deptX, prevY + 50, deptX, contactY - 50], {
            stroke: "hsl(214 32% 91%)",
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
          fabricCanvas.sendObjectToBack(line);
          allLines.push(line);
          nodeLines.push(line);
        }

        // Make node draggable with dynamic line updates
        contactNode.on('moving', function() {
          const center = contactNode.getCenterPoint();
          
          // Update lines connected to this node
          nodeLines.forEach((line) => {
            const points = line.get('x1') === deptX ? 
              [line.get('x1')!, line.get('y1')!, center.x, center.y - 50] :
              [center.x, center.y + 50, line.get('x2')!, line.get('y2')!];
            line.set({ x1: points[0], y1: points[1], x2: points[2], y2: points[3] });
            line.setCoords();
          });
        });

        // Hover effect - highlight node and connections
        contactNode.on('mouseover', function() {
          (this as FabricObject).set({ 
            shadow: { color: 'hsl(221 83% 53%)', blur: 20, offsetX: 0, offsetY: 0 }
          });
          nodeLines.forEach(line => line.set({ stroke: 'hsl(221 83% 53%)', strokeWidth: 3 }));
          fabricCanvas.renderAll();
        });

        contactNode.on('mouseout', function() {
          (this as FabricObject).set({ shadow: null });
          nodeLines.forEach(line => line.set({ stroke: 'hsl(214 32% 91%)', strokeWidth: 2 }));
          fabricCanvas.renderAll();
        });

        // Click handler
        contactNode.on('mousedown', () => {
          onContactClick(contact);
        });

        // Double-click to center
        contactNode.on('mousedblclick', () => {
          const center = contactNode.getCenterPoint();
          fabricCanvas.setZoom(1.5);
          const vpt = fabricCanvas.viewportTransform!;
          vpt[4] = fabricCanvas.width! / 2 - center.x * 1.5;
          vpt[5] = fabricCanvas.height! / 2 - center.y * 1.5;
          fabricCanvas.renderAll();
        });
        
        fabricCanvas.add(contactNode);

        // Store contact node reference with its connections
        contactNodesRef.current.set(contact.id, {
          contact,
          group: contactNode,
          lines: nodeLines,
          anchorPoints,
          originalPosition: { x: deptX, y: contactY },
        });
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, account, onContactClick]);

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

  const handleResetPositions = () => {
    if (!fabricCanvas) return;

    // Animate zoom and pan reset
    const currentZoom = fabricCanvas.getZoom();
    const currentVpt = [...fabricCanvas.viewportTransform!];
    
    // Smoothly animate zoom back to 1
    const zoomSteps = 20;
    const zoomIncrement = (1 - currentZoom) / zoomSteps;
    const vptXIncrement = (0 - currentVpt[4]) / zoomSteps;
    const vptYIncrement = (0 - currentVpt[5]) / zoomSteps;
    
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
        fabricCanvas.setZoom(1);
        fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        fabricCanvas.renderAll();
      }
    };
    animateZoom();

    // Animate all nodes back to original positions
    contactNodesRef.current.forEach(({ group, originalPosition, lines }) => {
      group.animate({
        left: originalPosition.x,
        top: originalPosition.y,
      }, {
        duration: 500,
        onChange: () => {
          group.setCoords();
          
          // Update connected lines during animation
          const center = group.getCenterPoint();
          lines.forEach((line) => {
            const isLineStart = line.get('x2') === center.x || Math.abs((line.get('x2') || 0) - originalPosition.x) < 1;
            if (isLineStart) {
              line.set({ x2: center.x, y2: center.y - 50 });
            } else {
              line.set({ x1: center.x, y1: center.y + 50 });
            }
            line.setCoords();
          });
          fabricCanvas.renderAll();
        },
        easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // easeInOutQuad
      });
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <CanvasSearch
        onSearch={handleSearch}
        onClear={handleClearSearch}
        matchCount={matchedNodes.length}
        currentMatchIndex={currentMatchIndex}
        onNextMatch={handleNextMatch}
        onPrevMatch={handlePrevMatch}
        onReset={handleResetPositions}
      />
      <canvas ref={canvasRef} />
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
};

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
