import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ActionConfirmation, type ConfirmationType } from '@/components/ui/ActionConfirmation';

interface ConfirmationPayload {
  type: ConfirmationType;
  title: string;
  message?: string;
}

interface ConfirmationContextValue {
  showConfirmation: (payload: ConfirmationPayload) => void;
}

const ConfirmationContext = createContext<ConfirmationContextValue>({
  showConfirmation: () => {},
});

export const useConfirmation = () => useContext(ConfirmationContext);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ConfirmationPayload | null>(null);

  const showConfirmation = useCallback((payload: ConfirmationPayload) => {
    setCurrent(payload);
  }, []);

  return (
    <ConfirmationContext.Provider value={{ showConfirmation }}>
      {children}
      {current && (
        <ActionConfirmation
          type={current.type}
          title={current.title}
          message={current.message}
          onDismiss={() => setCurrent(null)}
        />
      )}
    </ConfirmationContext.Provider>
  );
}
