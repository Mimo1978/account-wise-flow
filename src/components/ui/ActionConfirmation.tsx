import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type ConfirmationType = 'success' | 'warning' | 'error';

export interface ActionConfirmationProps {
  type: ConfirmationType;
  title: string;
  message?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const VARIANT_CONFIG: Record<ConfirmationType, { borderColor: string; Icon: typeof CheckCircle; iconColor: string }> = {
  success: { borderColor: '#2EAA6E', Icon: CheckCircle, iconColor: '#2EAA6E' },
  warning: { borderColor: '#E8A020', Icon: AlertTriangle, iconColor: '#E8A020' },
  error:   { borderColor: '#E84040', Icon: XCircle, iconColor: '#E84040' },
};

export function ActionConfirmation({ type, title, message, onDismiss, autoDismissMs = 3000 }: ActionConfirmationProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const { borderColor, Icon, iconColor } = VARIANT_CONFIG[type];

  useEffect(() => {
    requestAnimationFrame(() => setPhase('visible'));
    const timer = setTimeout(() => setPhase('exit'), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  useEffect(() => {
    if (phase === 'exit') {
      const t = setTimeout(onDismiss, 150);
      return () => clearTimeout(t);
    }
  }, [phase, onDismiss]);

  const isVisible = phase === 'visible';

  return (
    <div
      className="fixed z-[99999] pointer-events-auto"
      style={{
        top: '40%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${isVisible ? 1 : phase === 'enter' ? 0.8 : 0.95})`,
        opacity: isVisible ? 1 : 0,
        transition: phase === 'exit' ? 'all 150ms ease-in' : 'all 200ms ease-out',
      }}
    >
      <div
        className="flex flex-col items-center text-center px-8 py-6 rounded-2xl"
        style={{
          width: 360,
          background: '#1A1F2E',
          border: `2px solid ${borderColor}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <Icon className="mb-3" style={{ width: 48, height: 48, color: iconColor }} />
        <p className="text-lg font-bold text-white mb-1">{title}</p>
        {message && <p className="text-sm text-gray-400 mb-4">{message}</p>}
        <Button
          className="w-full h-11 mt-2"
          onClick={() => setPhase('exit')}
        >
          OK
        </Button>
      </div>
    </div>
  );
}
