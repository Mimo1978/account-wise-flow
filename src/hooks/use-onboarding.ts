import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingState {
  completed: boolean;
  role?: string;
  goal?: string;
  tooltipsShown: boolean;
}

const ONBOARDING_KEY = "client-mapper-onboarding";

export const useOnboarding = () => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    completed: true, // Default to true to avoid flash
    tooltipsShown: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load onboarding state from localStorage
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const storageKey = `${ONBOARDING_KEY}-${user.id}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OnboardingState;
        setState(parsed);
      } catch {
        // If parsing fails, treat as new user
        setState({ completed: false, tooltipsShown: false });
      }
    } else {
      // New user - show onboarding
      setState({ completed: false, tooltipsShown: false });
    }
    
    setIsLoading(false);
  }, [user]);

  const completeOnboarding = (role: string, goal: string) => {
    if (!user) return;

    const newState: OnboardingState = {
      completed: true,
      role,
      goal,
      tooltipsShown: false, // Will show tooltips next
    };

    const storageKey = `${ONBOARDING_KEY}-${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(newState));
    setState(newState);
  };

  const skipOnboarding = () => {
    if (!user) return;

    const newState: OnboardingState = {
      completed: true,
      tooltipsShown: true, // Skip tooltips too
    };

    const storageKey = `${ONBOARDING_KEY}-${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(newState));
    setState(newState);
  };

  const completeTooltips = () => {
    if (!user) return;

    const newState: OnboardingState = {
      ...state,
      tooltipsShown: true,
    };

    const storageKey = `${ONBOARDING_KEY}-${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(newState));
    setState(newState);
  };

  const dismissTooltips = () => {
    completeTooltips();
  };

  const resetOnboarding = () => {
    if (!user) return;

    const storageKey = `${ONBOARDING_KEY}-${user.id}`;
    localStorage.removeItem(storageKey);
    setState({ completed: false, tooltipsShown: false });
  };

  return {
    showOnboardingModal: !isLoading && !state.completed,
    showTooltips: !isLoading && state.completed && !state.tooltipsShown,
    userRole: state.role,
    userGoal: state.goal,
    completeOnboarding,
    skipOnboarding,
    completeTooltips,
    dismissTooltips,
    resetOnboarding,
    isLoading,
  };
};
