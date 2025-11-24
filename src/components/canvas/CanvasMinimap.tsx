import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, Rect, FabricObject } from "fabric";

interface CanvasMinimapProps {
  mainCanvas: FabricCanvas | null;
  width?: number;
  height?: number;
}

export const CanvasMinimap = ({ mainCanvas, width = 200, height = 150 }: CanvasMinimapProps) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<FabricCanvas | null>(null);

  useEffect(() => {
    if (!minimapCanvasRef.current || !mainCanvas) return;

    // Create minimap canvas
    const minimap = new FabricCanvas(minimapCanvasRef.current, {
      width,
      height,
      backgroundColor: "hsl(210 40% 96%)",
      selection: false,
      renderOnAddRemove: false,
    });

    minimapRef.current = minimap;

    return () => {
      minimap.dispose();
    };
  }, [mainCanvas, width, height]);

  useEffect(() => {
    if (!mainCanvas || !minimapRef.current) return;

    const updateMinimap = async () => {
      if (!minimapRef.current || !mainCanvas) return;

      const minimap = minimapRef.current;
      
      // Clear minimap
      minimap.clear();
      minimap.backgroundColor = "hsl(210 40% 96%)";

      // Calculate scale to fit entire main canvas
      const scaleX = width / mainCanvas.width!;
      const scaleY = height / mainCanvas.height!;
      const scale = Math.min(scaleX, scaleY);

      // Clone and scale down main canvas objects
      const objects = mainCanvas.getObjects();
      for (const obj of objects) {
        const cloned = await obj.clone();
        cloned.scale(scale);
        cloned.set({
          left: (obj.left || 0) * scale,
          top: (obj.top || 0) * scale,
          selectable: false,
          evented: false,
        });
        minimap.add(cloned);
      }

      // Draw viewport indicator
      const zoom = mainCanvas.getZoom();
      const vpt = mainCanvas.viewportTransform!;
      
      const viewportX = -vpt[4] / zoom;
      const viewportY = -vpt[5] / zoom;
      const viewportWidth = mainCanvas.width! / zoom;
      const viewportHeight = mainCanvas.height! / zoom;

      const viewportRect = new Rect({
        left: viewportX * scale,
        top: viewportY * scale,
        width: viewportWidth * scale,
        height: viewportHeight * scale,
        fill: "hsl(221 83% 53% / 0.1)",
        stroke: "hsl(221 83% 53%)",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });

      minimap.add(viewportRect);
      minimap.bringObjectToFront(viewportRect);
      minimap.renderAll();
    };

    // Update minimap on main canvas changes
    const handleCanvasChange = () => {
      requestAnimationFrame(updateMinimap);
    };

    mainCanvas.on('after:render', handleCanvasChange);
    mainCanvas.on('object:modified', handleCanvasChange);
    mainCanvas.on('object:moving', handleCanvasChange);

    // Handle viewport changes
    let isMinimapDragging = false;

    const handleMinimapClick = (e: any) => {
      if (!mainCanvas || !minimapRef.current) return;

      const pointer = minimapRef.current.getPointer(e.e);
      const scaleX = width / mainCanvas.width!;
      const scaleY = height / mainCanvas.height!;
      const scale = Math.min(scaleX, scaleY);

      const targetX = pointer.x / scale;
      const targetY = pointer.y / scale;
      const zoom = mainCanvas.getZoom();

      const vpt = mainCanvas.viewportTransform!;
      vpt[4] = -(targetX * zoom) + mainCanvas.width! / 2;
      vpt[5] = -(targetY * zoom) + mainCanvas.height! / 2;

      mainCanvas.requestRenderAll();
    };

    if (minimapRef.current) {
      minimapRef.current.on('mouse:down', () => {
        isMinimapDragging = true;
      });

      minimapRef.current.on('mouse:move', (e) => {
        if (isMinimapDragging) {
          handleMinimapClick(e);
        }
      });

      minimapRef.current.on('mouse:up', () => {
        isMinimapDragging = false;
      });
    }

    // Initial update
    updateMinimap();

    return () => {
      mainCanvas.off('after:render', handleCanvasChange);
      mainCanvas.off('object:modified', handleCanvasChange);
      mainCanvas.off('object:moving', handleCanvasChange);
    };
  }, [mainCanvas, width, height]);

  return (
    <div className="absolute bottom-4 right-4 rounded-lg border-2 border-border shadow-lg overflow-hidden bg-background">
      <canvas ref={minimapCanvasRef} className="cursor-pointer" />
    </div>
  );
};
