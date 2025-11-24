import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject, Image as FabricImage, Point } from "fabric";
import { Account, Contact } from "@/lib/types";
import { CanvasSearch } from "./CanvasSearch";
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
}

export const AccountCanvas = ({ account, onContactClick }: AccountCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedNodes, setMatchedNodes] = useState<ContactNodeData[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contactNodesRef = useRef<Map<string, ContactNodeData>>(new Map());

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
    const companyNode = createCompanyNode(account.name, fabricCanvas.width! / 2, 100);
    fabricCanvas.add(companyNode);

    // Group contacts by department and render
    const departments = Array.from(new Set(account.contacts.map(c => c.department)));
    const depWidth = fabricCanvas.width! / (departments.length + 1);

    departments.forEach((dept, deptIdx) => {
      const deptContacts = account.contacts.filter(c => c.department === dept);
      const deptX = depWidth * (deptIdx + 1);

      // Department label
      const deptLabel = new Text(dept, {
        left: deptX,
        top: 220,
        fontSize: 16,
        fontWeight: "600",
        fill: "hsl(215 16% 47%)",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(deptLabel);

      // Render contacts in this department
      deptContacts.forEach((contact, idx) => {
        const contactY = 300 + idx * 160;
        const contactNode = createContactNode(contact, deptX, contactY);
        
        // Calculate anchor points
        const anchorPoints = [
          new Point(deptX, contactY - 60), // top
          new Point(deptX - 60, contactY), // left
          new Point(deptX + 60, contactY), // right
          new Point(deptX, contactY + 60), // bottom
        ];

        const nodeLines: Line[] = [];

        // Draw line from company to first contact in dept
        if (idx === 0) {
          const line = new Line([fabricCanvas.width! / 2, 140, deptX, contactY - 60], {
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
          const prevY = 300 + (idx - 1) * 160;
          const line = new Line([deptX, prevY + 60, deptX, contactY - 60], {
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
              [line.get('x1')!, line.get('y1')!, center.x, center.y - 60] :
              [center.x, center.y + 60, line.get('x2')!, line.get('y2')!];
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
      const circle = group.getObjects()[0] as Circle;
      if (originalStroke !== undefined) {
        circle.set({ 
          stroke: originalStroke as string | undefined, 
          strokeWidth: originalStrokeWidth || 0 
        });
      } else {
        circle.set({ stroke: undefined, strokeWidth: 0 });
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
      const circle = group.getObjects()[0] as Circle;

      // Store original stroke if not already stored
      if (nodeData.originalStroke === undefined) {
        nodeData.originalStroke = typeof circle.stroke === 'string' ? circle.stroke : null;
        nodeData.originalStrokeWidth = circle.strokeWidth;
      }

      const isMatch =
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.title.toLowerCase().includes(lowerQuery) ||
        contact.department.toLowerCase().includes(lowerQuery) ||
        contact.status.toLowerCase().includes(lowerQuery);

      if (isMatch) {
        matches.push(nodeData);
        circle.set({
          stroke: "hsl(221 83% 53%)",
          strokeWidth: 5,
        });
      } else {
        // Reset to original
        circle.set({
          stroke: nodeData.originalStroke as string | undefined,
          strokeWidth: nodeData.originalStrokeWidth || 0,
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
      const circle = group.getObjects()[0] as Circle;
      if (originalStroke !== undefined) {
        circle.set({ 
          stroke: originalStroke as string | undefined, 
          strokeWidth: originalStrokeWidth || 0 
        });
      } else {
        circle.set({ stroke: undefined, strokeWidth: 0 });
      }
    });

    fabricCanvas.renderAll();
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
      />
      <canvas ref={canvasRef} />
    </div>
  );
};

const createCompanyNode = (name: string, x: number, y: number): Group => {
  const circle = new Circle({
    radius: 40,
    fill: "hsl(221 83% 53%)",
    strokeWidth: 0,
  });

  const text = new Text(name, {
    fontSize: 18,
    fontWeight: "bold",
    fill: "white",
    originX: "center",
    originY: "center",
  });

  const group = new Group([circle, text], {
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

  // Outer circle for the node
  const outerCircle = new Circle({
    radius: 60,
    fill: bgColor,
    strokeWidth: contact.status === "champion" ? 4 : 2,
    stroke: contact.status === "champion" ? "hsl(142 71% 35%)" : "hsl(0 0% 100% / 0.3)",
  });

  // Inner circle for profile image placeholder
  const innerCircle = new Circle({
    radius: 45,
    fill: "hsl(0 0% 100% / 0.9)",
    strokeWidth: 0,
  });

  // Create silhouette icon (randomly male/female)
  const isMale = Math.random() > 0.5;
  const silhouetteText = new Text(isMale ? "👤" : "👤", {
    fontSize: 40,
    fill: "hsl(215 16% 47%)",
    originX: "center",
    originY: "center",
    top: -5,
  });

  // Name below the circle
  const nameText = new Text(contact.name, {
    fontSize: 12,
    fontWeight: "600",
    fill: "hsl(222 47% 11%)",
    originX: "center",
    originY: "center",
    top: 75,
    textAlign: "center",
  });

  // Title below name
  const titleText = new Text(contact.title, {
    fontSize: 10,
    fill: "hsl(215 16% 47%)",
    originX: "center",
    originY: "center",
    top: 90,
    textAlign: "center",
  });

  // Magnetic anchor points (small circles)
  const anchorTop = new Circle({
    radius: 4,
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
    top: -60,
    opacity: 0,
  });

  const anchorBottom = new Circle({
    radius: 4,
    fill: "hsl(221 83% 53%)",
    originX: "center",
    originY: "center",
    top: 60,
    opacity: 0,
  });

  const group = new Group([outerCircle, innerCircle, silhouetteText, anchorTop, anchorBottom, nameText, titleText], {
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
