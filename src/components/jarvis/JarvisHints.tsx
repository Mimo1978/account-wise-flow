import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HintPillProps {
  storageKey: string;
  message: string;
  autoHideMs?: number;
  className?: string;
}

export function JarvisHintPill({ storageKey, message, autoHideMs = 8000, className }: HintPillProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) return;
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(storageKey, '1');
    }, autoHideMs);

    const handleClick = () => {
      setVisible(false);
      localStorage.setItem(storageKey, '1');
    };

    document.addEventListener('click', handleClick, { once: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [storageKey, autoHideMs]);

  if (!visible) return null;

  return (
    <div className={cn(
      "animate-fade-in flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground shadow-sm",
      className
    )}>
      <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <span className="text-xs">{message}</span>
    </div>
  );
}

interface InlineHintProps {
  storageKey: string;
  message: string;
  variant?: 'blue' | 'amber';
  className?: string;
}

export function JarvisInlineHint({ storageKey, message, variant = 'blue', className }: InlineHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, '1');
  };

  return (
    <div className={cn(
      "animate-fade-in flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
      variant === 'blue' && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
      variant === 'amber' && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
      className
    )}>
      <span className="flex-1">💡 {message}</span>
      <button onClick={dismiss} className="hover:opacity-70 transition-opacity flex-shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
