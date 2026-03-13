import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface PageBackButtonProps {
  /** Optional label — defaults to smart label based on route */
  label?: string;
  /** Optional explicit fallback route if history is empty */
  fallback?: string;
  className?: string;
}

export function PageBackButton({ label, fallback, className }: PageBackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getLabel = () => {
    if (label) return label;
    const state = location.state as { fromLabel?: string; from?: string } | null;
    if (state?.fromLabel) return state.fromLabel;
    const from = state?.from || '';
    if (from.includes('/companies')) return 'Back to Companies';
    if (from.includes('/deals')) return 'Back to Deals';
    if (from.includes('/projects')) return 'Back to Projects';
    if (from.includes('/contacts')) return 'Back to Contacts';
    if (from.includes('/jobs')) return 'Back to Jobs';
    if (from.includes('/talent')) return 'Back to Talent';
    if (from.includes('/home')) return 'Back to Home';
    if (from.includes('/outreach')) return 'Back to Outreach';
    if (from.includes('/admin')) return 'Back to Admin';
    return 'Back';
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else if (fallback) {
      navigate(fallback);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="
        inline-flex items-center gap-1.5
        text-sm font-medium
        text-foreground
        px-2 py-1 -ml-2 rounded-md
        transition-all duration-150
        hover:bg-accent
        border-l-2 border-transparent
        hover:border-primary
        group
      "
    >
      <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
      {getLabel()}
    </button>
  );
}
