import { useState, useCallback, useMemo } from "react";
import {
  DemoScenarioId,
  DemoScenario,
  demoScenarios,
  defaultScenarioId,
  getScenarioById,
} from "@/lib/demo-scenarios";
import { Account, Talent, TalentEngagement } from "@/lib/types";

interface UseDemoScenarioReturn {
  // Current scenario
  scenarioId: DemoScenarioId;
  scenario: DemoScenario;
  
  // Derived data
  accounts: Account[];
  currentAccount: Account;
  talents: Talent[];
  engagements: TalentEngagement[];
  
  // Actions
  setScenarioId: (id: DemoScenarioId) => void;
  setCurrentAccountId: (id: string) => void;
  
  // For updating local state (demo modifications)
  updateAccount: (account: Account) => void;
}

export const useDemoScenario = (): UseDemoScenarioReturn => {
  const [scenarioId, setScenarioIdState] = useState<DemoScenarioId>(defaultScenarioId);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, Account>>({});

  const scenario = useMemo(() => {
    return getScenarioById(scenarioId) || demoScenarios[0];
  }, [scenarioId]);

  const accounts = useMemo(() => {
    return scenario.accounts.map(acc => accountOverrides[acc.id] || acc);
  }, [scenario, accountOverrides]);

  const currentAccount = useMemo(() => {
    if (currentAccountId) {
      const found = accounts.find(a => a.id === currentAccountId);
      if (found) return found;
    }
    return accounts[0];
  }, [accounts, currentAccountId]);

  const talents = useMemo(() => {
    return scenario.talents || [];
  }, [scenario]);

  const engagements = useMemo(() => {
    return scenario.engagements || [];
  }, [scenario]);

  const setScenarioId = useCallback((id: DemoScenarioId) => {
    setScenarioIdState(id);
    setCurrentAccountId(null);
    setAccountOverrides({});
  }, []);

  const updateAccount = useCallback((account: Account) => {
    setAccountOverrides(prev => ({
      ...prev,
      [account.id]: account,
    }));
  }, []);

  return {
    scenarioId,
    scenario,
    accounts,
    currentAccount,
    talents,
    engagements,
    setScenarioId,
    setCurrentAccountId,
    updateAccount,
  };
};
