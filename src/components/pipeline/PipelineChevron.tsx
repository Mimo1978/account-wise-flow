import { useState, useEffect, useRef, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight } from 'lucide-react';

/* ─── Stage definitions ─── */
export const PIPELINE_STAGES = [
  { key: 'lead',        label: 'LEAD',        color: '#4F7FE8' },
  { key: 'qualified',   label: 'QUALIFIED',   color: '#7B5FD4' },
  { key: 'proposal',    label: 'PROPOSAL',    color: '#E8A020' },
  { key: 'negotiation', label: 'NEGOTIATION', color: '#E86820' },
  { key: 'won',         label: 'WON',         color: '#2EAA6E' },
  { key: 'placed',      label: 'PLACED',      color: '#F59E0B' },
  { key: 'lost',        label: 'LOST',        color: '#E84040' },
] as const;

const STAGE_KEYS = PIPELINE_STAGES.map(s => s.key);

export interface PipelineChevronProps {
  mode: 'summary' | 'filter' | 'progress';

  /* filter / summary mode */
  deals?: { stage?: string; value?: number }[];
  selectedStage?: string | null;
  onStageClick?: (stage: string | null) => void;

  /* progress mode (single deal) */
  currentStage?: string;
  onAdvance?: () => void;
  onStageSelect?: (stage: string) => void;
  dealTitle?: string;

  showCounts?: boolean;
  showValues?: boolean;
  compact?: boolean;
}

/* ─── Single chevron (filter / summary) ─── */
function FilterChevron({
  stage, isFirst, isActive, isLit, count, value, compact, onClick,
}: {
  stage: typeof PIPELINE_STAGES[number];
  isFirst: boolean;
  isActive: boolean;
  isLit: boolean;
  count: number;
  value: number;
  compact: boolean;
  onClick: () => void;
}) {
  const [pulse, setPulse] = useState(false);
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !prevActive.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
    prevActive.current = isActive;
  }, [isActive]);

  const h = compact ? 44 : 52;

  return (
    <button
      onClick={onClick}
      className="relative flex-1 group"
      style={{
        minWidth: 100,
        filter: isLit ? (isActive ? 'brightness(1)' : 'brightness(0.85)') : 'brightness(0.5)',
        opacity: isLit ? (isActive ? 1 : 0.75) : 0.3,
        transform: isLit ? (isActive ? 'scale(1.02)' : 'scale(1)') : 'scale(0.97)',
        transition: 'filter 280ms ease-out, opacity 280ms ease-out, transform 280ms ease-out',
        animation: pulse ? 'chevron-pulse 0.6s ease-in-out' : undefined,
      }}
    >
      <svg viewBox="0 0 200 56" preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }} aria-hidden>
        <polygon
          points={isFirst
            ? '0,0 186,0 200,28 186,56 0,56'
            : '0,0 186,0 200,28 186,56 0,56 14,28'}
          fill={stage.color}
          className="transition-all duration-200 group-hover:brightness-110"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ padding: '0 4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', lineHeight: 1, color: '#fff', textTransform: 'uppercase' as const }}>{stage.label}</span>
        <span style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.2, color: '#fff', marginTop: '2px' }}>{count}</span>
        <span style={{ fontSize: '11px', lineHeight: 1, color: 'rgba(255,255,255,0.8)' }}>£{value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toLocaleString()}</span>
      </div>
    </button>
  );
}

/* ─── Single chevron (progress / detail) ─── */
function ProgressChevron({
  stage, isFirst, isCurrent, isPast, isFuture, compact, dealTitle, onStageSelect,
}: {
  stage: typeof PIPELINE_STAGES[number];
  isFirst: boolean;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  compact: boolean;
  dealTitle?: string;
  onStageSelect?: (stage: string) => void;
}) {
  const [pulse, setPulse] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (isCurrent) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [isCurrent]);

  const h = compact ? 44 : 52;
  const isLost = stage.key === 'lost';
  const bgColor = isCurrent
    ? stage.color
    : isPast
      ? stage.color
      : '#1E2436';
  const textColor = (isCurrent || isPast) ? '#FFFFFF' : '#6B7280';
  const opacity = isCurrent ? 1 : isPast ? 0.75 : 0.5;

  const direction = isPast ? 'backward' : 'forward';

  const handleClick = () => {
    if (isCurrent || !onStageSelect) return;
    setConfirmOpen(true);
  };

  return (
    <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleClick}
          className="relative flex-1 group"
          style={{
            minWidth: 100,
            opacity,
            cursor: isCurrent ? 'default' : 'pointer',
            transition: 'filter 150ms ease-out, opacity 300ms ease',
            animation: pulse && isCurrent ? 'chevron-pulse 0.6s ease-in-out' : undefined,
            filter: (!isCurrent && !isPast) ? 'brightness(0.7)' : 'brightness(1)',
          }}
        >
          <svg viewBox="0 0 200 56" preserveAspectRatio="none" style={{ width: '100%', height: h }} aria-hidden>
            <polygon
              points={isFirst
                ? '0,0 186,0 200,28 186,56 0,56'
                : '0,0 186,0 200,28 186,56 0,56 14,28'}
              fill={bgColor}
              className="transition-all duration-200 group-hover:brightness-[1.15]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2">
            <span className="text-[11px] font-bold uppercase tracking-wider leading-none" style={{ color: textColor }}>
              {stage.label}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      {confirmOpen && onStageSelect && (
        <PopoverContent className="w-72 p-4 z-[9999]" align="center">
          <div className="flex items-start gap-2 mb-3">
            {direction === 'backward' ? (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            )}
            <p className="text-sm">
              {direction === 'backward'
                ? <>Move <strong>{dealTitle}</strong> back to <strong>{stage.label}</strong>? This will affect pipeline metrics.</>
                : <>Move <strong>{dealTitle}</strong> to <strong>{stage.label}</strong>?</>
              }
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { onStageSelect(stage.key); setConfirmOpen(false); }}>
              {direction === 'backward' ? 'Move Back' : 'Confirm'}
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

/* ─── Main component ─── */
export function PipelineChevron({
  mode,
  deals = [],
  selectedStage,
  onStageClick,
  currentStage,
  onStageSelect,
  dealTitle,
  showCounts = true,
  showValues = true,
  compact = false,
}: PipelineChevronProps) {
  /* ─── Cascade animation for filter/summary ─── */
  const [litStages, setLitStages] = useState<string[]>(STAGE_KEYS);
  const [animating, setAnimating] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (mode === 'progress') return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLitStages([]);
    setAnimating(true);

    // cascade in
    STAGE_KEYS.forEach((key, i) => {
      const t = setTimeout(() => setLitStages(prev => [...prev, key]), 100 + i * 100);
      timers.current.push(t);
    });
    // after cascade, settle all lit
    const settleTime = 100 + STAGE_KEYS.length * 100 + 200;
    timers.current.push(setTimeout(() => {
      setLitStages([...STAGE_KEYS]);
      setAnimating(false);
    }, settleTime));

    return () => timers.current.forEach(clearTimeout);
  }, [mode]);

  /* ─── Per-stage counts ─── */
  const stageTotals = useMemo(() => {
    const m: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach(s => { m[s.key] = { count: 0, value: 0 }; });
    deals.forEach(d => {
      const key = (d as any).stage || 'lead';
      if (m[key]) { m[key].count++; m[key].value += (d as any).value || 0; }
    });
    return m;
  }, [deals]);

  const currentIdx = currentStage ? STAGE_KEYS.indexOf(currentStage as any) : -1;

  if (mode === 'progress') {
    return (
      <div className="flex items-stretch -space-x-[2px] overflow-x-auto rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        {PIPELINE_STAGES.map((stage, idx) => (
          <ProgressChevron
            key={stage.key}
            stage={stage}
            isFirst={idx === 0}
            isCurrent={currentStage === stage.key}
            isPast={currentIdx > idx}
            isFuture={currentIdx < idx}
            compact={compact}
            dealTitle={dealTitle}
            onStageSelect={onStageSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', gap: '2px', width: '100%' }}>
      {PIPELINE_STAGES.map((stage, idx) => {
        const data = stageTotals[stage.key];
        const isActive = selectedStage === null || selectedStage === undefined || selectedStage === stage.key;
        return (
          <FilterChevron
            key={stage.key}
            stage={stage}
            isFirst={idx === 0}
            isActive={isActive}
            isLit={litStages.includes(stage.key)}
            count={showCounts ? data.count : 0}
            value={showValues ? data.value : 0}
            compact={compact}
            onClick={() => onStageClick?.(selectedStage === stage.key ? null : stage.key)}
          />
        );
      })}
    </div>
  );
}
