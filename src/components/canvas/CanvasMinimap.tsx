import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas } from "fabric";

interface CanvasMinimapProps {
  mainCanvas: FabricCanvas | null;
  width?: number;
  height?: number;
}

export const CanvasMinimap = ({ mainCanvas, width = 160, height = 100 }: CanvasMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boundsRef = useRef({ minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 });
  const rafRef = useRef<number | null>(null);
  const isDisposedRef = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || !mainCanvas) return;
    isDisposedRef.current = false;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (isDisposedRef.current || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'hsl(210, 40%, 96%)';
      ctx.fillRect(0, 0, width, height);

      const objects = mainCanvas.getObjects();
      if (objects.length === 0) return;

      // Calculate content bounds from groups only (nodes)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const groups: { x: number; y: number }[] = [];
      for (const obj of objects) {
        if (obj.type !== 'group' || !obj.visible) continue;
        const c = obj.getCenterPoint();
        groups.push(c);
        minX = Math.min(minX, c.x - 100);
        minY = Math.min(minY, c.y - 50);
        maxX = Math.max(maxX, c.x + 100);
        maxY = Math.max(maxY, c.y + 50);
      }
      if (minX === Infinity) return;

      const contentW = maxX - minX || 1;
      const contentH = maxY - minY || 1;
      const pad = 10;
      const sx = (width - pad * 2) / contentW;
      const sy = (height - pad * 2) / contentH;
      const scale = Math.min(sx, sy);
      const offsetX = pad + (width - pad * 2 - contentW * scale) / 2;
      const offsetY = pad + (height - pad * 2 - contentH * scale) / 2;
      boundsRef.current = { minX, minY, scale, offsetX, offsetY };

      // Draw dots for each node
      ctx.fillStyle = 'hsl(221, 83%, 53%)';
      for (const g of groups) {
        const dx = (g.x - minX) * scale + offsetX;
        const dy = (g.y - minY) * scale + offsetY;
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw viewport rect
      const zoom = mainCanvas.getZoom();
      const vpt = mainCanvas.viewportTransform!;
      const vpL = -vpt[4] / zoom;
      const vpT = -vpt[5] / zoom;
      const vpW = mainCanvas.width! / zoom;
      const vpH = mainCanvas.height! / zoom;
      const vx = (vpL - minX) * scale + offsetX;
      const vy = (vpT - minY) * scale + offsetY;
      const vw = vpW * scale;
      const vh = vpH * scale;

      ctx.fillStyle = 'hsla(221, 83%, 53%, 0.08)';
      ctx.fillRect(vx, vy, vw, vh);
      ctx.strokeStyle = 'hsl(221, 83%, 53%)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
    };

    let pending = false;
    const scheduleRender = () => {
      if (pending) return;
      pending = true;
      rafRef.current = requestAnimationFrame(() => { pending = false; render(); });
    };

    mainCanvas.on('after:render', scheduleRender);

    // Click / drag to navigate
    const navigate = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { minX, minY, scale, offsetX, offsetY } = boundsRef.current;
      const tx = (cx - offsetX) / scale + minX;
      const ty = (cy - offsetY) / scale + minY;
      const zoom = mainCanvas.getZoom();
      const vpt = mainCanvas.viewportTransform!;
      vpt[4] = -(tx * zoom) + mainCanvas.width! / 2;
      vpt[5] = -(ty * zoom) + mainCanvas.height! / 2;
      mainCanvas.requestRenderAll();
    };

    let dragging = false;
    const el = canvasRef.current;
    const onDown = () => { dragging = true; };
    const onMove = (e: MouseEvent) => { if (dragging) navigate(e); };
    const onUp = () => { dragging = false; };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('click', navigate);

    render();

    return () => {
      isDisposedRef.current = true;
      mainCanvas.off('after:render', scheduleRender);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', navigate);
    };
  }, [mainCanvas, width, height]);

  return (
    <div className="absolute bottom-4 right-4 rounded-lg border-2 border-border shadow-lg overflow-hidden bg-background">
      <canvas ref={canvasRef} width={width} height={height} className="cursor-pointer" style={{ width, height }} />
    </div>
  );
};
