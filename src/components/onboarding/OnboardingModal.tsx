import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, Briefcase, Users, Target, Zap, Building2 } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onComplete: (role: string, goal: string) => void;
  onSkip: () => void;
}

const roles = [
  { value: "sales", label: "Sales", icon: Target },
  { value: "consulting", label: "Consulting", icon: Briefcase },
  { value: "recruiting", label: "Recruiting", icon: Users },
  { value: "founder", label: "Founder", icon: Building2 },
  { value: "ops", label: "Operations", icon: Zap },
];

const goals = [
  { value: "sales-growth", label: "Sales Growth", description: "Close more deals, faster" },
  { value: "account-mapping", label: "Account Mapping", description: "Understand org structures" },
  { value: "hiring", label: "Hiring", description: "Find and track candidates" },
  { value: "all", label: "All of the Above", description: "Full relationship intelligence" },
];

export const OnboardingModal = ({ open, onComplete, onSkip }: OnboardingModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedGoal, setSelectedGoal] = useState<string>("");

  const handleNext = () => {
    if (step === 1 && selectedRole) {
      setStep(2);
    } else if (step === 2 && selectedGoal) {
      onComplete(selectedRole, selectedGoal);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === 1 ? "Welcome to Client Mapper" : "What's your primary goal?"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Tell us about your role so we can personalize your experience."
              : "We'll tailor your workspace to help you succeed."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 ? (
            <RadioGroup value={selectedRole} onValueChange={setSelectedRole} className="gap-3">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={role.value} id={role.value} />
                    <Label
                      htmlFor={role.value}
                      className="flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="font-medium">{role.label}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          ) : (
            <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal} className="gap-3">
              {goals.map((goal) => (
                <div key={goal.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={goal.value} id={goal.value} />
                  <Label
                    htmlFor={goal.value}
                    className="flex flex-col cursor-pointer flex-1 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{goal.label}</span>
                    <span className="text-sm text-muted-foreground">{goal.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            Skip for now
          </Button>
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={step === 1 ? !selectedRole : !selectedGoal}
              className="gap-2"
            >
              {step === 1 ? "Next" : "Get Started"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 pt-2">
          <div className={`w-2 h-2 rounded-full ${step === 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`w-2 h-2 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
