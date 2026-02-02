import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, X } from "lucide-react";
import { Account, RelationshipStatus } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100, "Company name must be less than 100 characters"),
  headquarters: z.string().max(100, "Headquarters must be less than 100 characters").optional(),
  switchboard: z.string().max(30, "Phone number must be less than 30 characters").optional(),
  industry: z.string().max(50, "Industry must be less than 50 characters").optional(),
  relationshipStatus: z.enum(["active", "warm", "cooling", "dormant"]).optional(),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

const REGION_OPTIONS = [
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East",
  "Africa",
  "UK & Ireland",
  "DACH",
  "Nordics",
  "ANZ",
];

const INDUSTRY_OPTIONS = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Energy",
  "Media & Entertainment",
  "Professional Services",
  "Government",
  "Education",
  "Real Estate",
  "Transportation",
];

const STATUS_OPTIONS: { value: RelationshipStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "warm", label: "Warm" },
  { value: "cooling", label: "Cooling" },
  { value: "dormant", label: "Dormant" },
];

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated: (company: Account) => void;
}

export function CreateCompanyModal({ open, onOpenChange, onCompanyCreated }: CreateCompanyModalProps) {
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      headquarters: "",
      switchboard: "",
      industry: "",
      relationshipStatus: "warm",
      notes: "",
    },
  });

  const handleAddRegion = (region: string) => {
    if (!selectedRegions.includes(region)) {
      setSelectedRegions([...selectedRegions, region]);
    }
  };

  const handleRemoveRegion = (region: string) => {
    setSelectedRegions(selectedRegions.filter((r) => r !== region));
  };

  const resetForm = () => {
    form.reset();
    setSelectedRegions([]);
  };

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    
    try {
      // Create a new company object
      const newCompany: Account = {
        id: `company-${Date.now()}`,
        name: data.name,
        industry: data.industry || "Other",
        headquarters: data.headquarters || undefined,
        switchboard: data.switchboard || undefined,
        regions: selectedRegions.length > 0 ? selectedRegions : undefined,
        relationshipStatus: data.relationshipStatus || "warm",
        dataQuality: "partial",
        lastUpdated: new Date().toISOString(),
        accountManager: {
          name: "Current User",
          title: "Account Owner",
        },
        engagementScore: 50,
        contacts: [],
      };

      // Simulate a small delay for UX feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      onCompanyCreated(newCompany);
      
      toast({
        title: "Company created",
        description: `${data.name} has been added to your workspace.`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create company. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Create Company</DialogTitle>
              <DialogDescription>
                Add a new company to your workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Company Name - Required */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Company Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Headquarters */}
            <FormField
              control={form.control}
              name="headquarters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headquarters</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., London, UK" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Switchboard */}
            <FormField
              control={form.control}
              name="switchboard"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Switchboard</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., +44 20 7123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Industry */}
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Regions - Multi-select */}
            <div className="space-y-2">
              <FormLabel>Regions</FormLabel>
              <Select onValueChange={handleAddRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Add regions..." />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.filter((r) => !selectedRegions.includes(r)).map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRegions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRegions.map((region) => (
                    <Badge
                      key={region}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {region}
                      <button
                        type="button"
                        onClick={() => handleRemoveRegion(region)}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <FormField
              control={form.control}
              name="relationshipStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any initial notes about this company..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Company
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
