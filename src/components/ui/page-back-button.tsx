import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface PageBackButtonProps {
  /** Optional label — defaults to "Back" */
  label?: string;
  /** Optional explicit fallback route if history is empty */
  fallback?: string;
  className?: string;
}

export function PageBackButton({ label = 'Back', fallback, className }: PageBackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    // If there's history, go back; otherwise navigate to fallback
    if (window.history.length > 2) {
      navigate(-1);
    } else if (fallback) {
      navigate(fallback);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`gap-1 text-muted-foreground hover:text-foreground -ml-2 ${className ?? ''}`}
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
