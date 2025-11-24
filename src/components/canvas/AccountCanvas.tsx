import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Text, Line, Group, FabricObject } from "fabric";
import { Account, Contact } from "@/lib/types";
import { ContactNode } from "./ContactNode";
import { CanvasSearch } from "./CanvasSearch";

interface AccountCanvasProps {
  account: Account;
}

interface ContactNodeData {
  contact: Contact;
  group: Group;
  originalStroke?: string | null;
  originalStrokeWidth?: number;
}

export const AccountCanvas = ({ account }: AccountCanvasProps) => {
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
      selection: true,
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
      });
      fabricCanvas.add(deptLabel);

      // Render contacts in this department
      deptContacts.forEach((contact, idx) => {
        const contactY = 300 + idx * 140;
        const contactNode = createContactNode(contact, deptX, contactY);
        fabricCanvas.add(contactNode);

        // Store contact node reference
        contactNodesRef.current.set(contact.id, {
          contact,
          group: contactNode,
        });

        // Draw line from company to first contact in dept
        if (idx === 0) {
          const line = new Line([fabricCanvas.width! / 2, 140, deptX, contactY - 50], {
            stroke: "hsl(214 32% 91%)",
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
          fabricCanvas.sendObjectToBack(line);
        }

        // Draw lines between contacts in same dept
        if (idx > 0) {
          const prevY = 300 + (idx - 1) * 140;
          const line = new Line([deptX, prevY + 50, deptX, contactY - 50], {
            stroke: "hsl(214 32% 91%)",
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
          fabricCanvas.sendObjectToBack(line);
        }
      });
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, account]);

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

  const rect = new Circle({
    radius: 50,
    fill: bgColor,
    strokeWidth: contact.status === "champion" ? 3 : 0,
    stroke: contact.status === "champion" ? "hsl(142 71% 35%)" : undefined,
  });

  const nameText = new Text(contact.name, {
    fontSize: 14,
    fontWeight: "600",
    fill: "white",
    originX: "center",
    originY: "center",
    top: -10,
  });

  const titleText = new Text(contact.title, {
    fontSize: 11,
    fill: "white",
    originX: "center",
    originY: "center",
    top: 10,
  });

  const group = new Group([rect, nameText, titleText], {
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

  // Hover effect
  group.on("mouseover", function () {
    (this as FabricObject).set({ scaleX: 1.05, scaleY: 1.05 });
    (this as FabricObject).canvas?.renderAll();
  });

  group.on("mouseout", function () {
    (this as FabricObject).set({ scaleX: 1, scaleY: 1 });
    (this as FabricObject).canvas?.renderAll();
  });

  return group;
};
