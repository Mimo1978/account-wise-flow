import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Target, 
  ChevronDown,
  Sparkles,
  Check
} from "lucide-react";
import { DemoScenarioId, demoScenarios, DemoScenario } from "@/lib/demo-scenarios";

interface DemoScenarioSelectorProps {
  currentScenarioId: DemoScenarioId;
  onScenarioChange: (scenarioId: DemoScenarioId) => void;
}

const getScenarioIcon = (iconName: string) => {
  switch (iconName) {
    case "TrendingUp":
      return TrendingUp;
    case "AlertTriangle":
      return AlertTriangle;
    case "Users":
      return Users;
    case "Target":
      return Target;
    default:
      return Sparkles;
  }
};

const getScenarioColor = (id: DemoScenarioId) => {
  switch (id) {
    case "account-expansion":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "renewal-risk":
      return "text-red-600 bg-red-50 border-red-200";
    case "recruiting-pipeline":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "new-logo-prospecting":
      return "text-purple-600 bg-purple-50 border-purple-200";
    default:
      return "text-primary bg-primary/10 border-primary/20";
  }
};

export const DemoScenarioSelector = ({
  currentScenarioId,
  onScenarioChange,
}: DemoScenarioSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentScenario = demoScenarios.find(s => s.id === currentScenarioId);
  
  if (!currentScenario) return null;

  const CurrentIcon = getScenarioIcon(currentScenario.icon);
  const colorClass = getScenarioColor(currentScenarioId);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 border ${colorClass} hover:opacity-90 transition-opacity`}
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden sm:inline font-medium">{currentScenario.name}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Demo Scenario
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {demoScenarios.map((scenario) => {
          const Icon = getScenarioIcon(scenario.icon);
          const isActive = scenario.id === currentScenarioId;
          
          return (
            <DropdownMenuItem
              key={scenario.id}
              onClick={() => {
                onScenarioChange(scenario.id);
                setIsOpen(false);
              }}
              className={`flex items-start gap-3 p-3 cursor-pointer ${
                isActive ? "bg-muted" : ""
              }`}
            >
              <div className={`p-2 rounded-lg ${getScenarioColor(scenario.id)} mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{scenario.name}</span>
                  {isActive && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {scenario.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Switch scenarios to explore different use cases
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
