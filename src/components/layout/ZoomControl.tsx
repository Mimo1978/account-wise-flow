import { useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const STORAGE_KEY = 'app:contentZoom';
const DEFAULT_ZOOM = 0.8;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.25;
const STEP = 0.1;

function readZoom(): number {
  if (typeof window === 'undefined') return DEFAULT_ZOOM;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseFloat(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) return parsed;
  return DEFAULT_ZOOM;
}

function applyZoom(z: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--app-content-zoom', String(z));
  // Broadcast so any responsive listeners can re-evaluate if needed
  window.dispatchEvent(new CustomEvent('app:zoom-change', { detail: { zoom: z } }));
}

export const ZoomControl: React.FC = () => {
  const [zoom, setZoom] = useState<number>(() => readZoom());

  useEffect(() => {
    applyZoom(zoom);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {}
  }, [zoom]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + STEP) * 100) / 100));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - STEP) * 100) / 100));
  }, []);
  const reset = useCallback(() => setZoom(DEFAULT_ZOOM), []);

  const pct = Math.round(zoom * 100);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/60 px-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={reset}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground tabular-nums px-1 min-w-[34px]"
              aria-label="Reset zoom to 80%"
            >
              {pct}%
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset to 80%</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default ZoomControl;