import { useState, useEffect, useCallback, useMemo } from "react";
import { ImportEntity, ImportEntityStatus, StoreDestination, DuplicateMatch, ApprovalOptions } from "@/hooks/use-import-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Save,
  AlertTriangle,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Linkedin,
  ExternalLink,
  Users,
  Building2,
  UserPlus,
  Merge,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { BestNextActionsPanel } from "./BestNextActionsPanel";

interface Company {
  id: string;
  name: string;
}

interface EntityEditFormProps {
  entity: ImportEntity;
  onUpdate: (entityId: string, updates: Partial<ImportEntity>) => Promise<boolean>;
  onApprove: (entityId: string, options?: ApprovalOptions) => Promise<{ success: boolean; candidateId?: string; contactId?: string; companyId?: string; error?: string }>;
  onReject: (entityId: string, reason?: string) => Promise<boolean>;
  onCheckDuplicates: (entity: ImportEntity) => Promise<DuplicateMatch[]>;
  onFetchCompanies: () => Promise<Company[]>;
  autoFocusName?: boolean;
}

export function EntityEditForm({ 
  entity, 
  onUpdate, 
  onApprove, 
  onReject, 
  onCheckDuplicates,
  onFetchCompanies,
  autoFocusName = false,
}: EntityEditFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Destination and company state
  const [destination, setDestination] = useState<StoreDestination>("candidate");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [createNewCompany, setCreateNewCompany] = useState(false);
  const [addToOrgChart, setAddToOrgChart] = useState(true);
  
  // Duplicate checking state
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [mergeChoice, setMergeChoice] = useState<"create" | "merge" | "link">("create");
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeTargetType, setMergeTargetType] = useState<"candidate" | "contact">("candidate");
  
  // Approval progress state
  const [approvalStep, setApprovalStep] = useState<string>("");
  
  // Approval result state
  const [approvalResult, setApprovalResult] = useState<{
    candidateId?: string;
    contactId?: string;
    companyId?: string;
  } | null>(null);

  // Initialize form data from entity
  useEffect(() => {
    const data = entity.edited_json || entity.extracted_json;
    setFormData(JSON.parse(JSON.stringify(data)));
    setHasChanges(false);
    setApprovalResult(null);
    
    // Set default destination based on entity type and data
    if (entity.entity_type === "candidate") {
      const headline = (data as any).headline || {};
      if (headline.current_company) {
        setDestination("both"); // Has company info, suggest both
      } else {
        setDestination("candidate");
      }
    } else if (entity.entity_type === "contact") {
      setDestination("contact");
    }
  }, [entity]);

  // Load companies on mount
  useEffect(() => {
    onFetchCompanies().then(setCompanies);
  }, [onFetchCompanies]);

  // Check for duplicates when entity changes
  useEffect(() => {
    const checkDups = async () => {
      if (entity.status !== "pending_review" && entity.status !== "needs_input") return;
      
      setIsCheckingDuplicates(true);
      const dups = await onCheckDuplicates(entity);
      setDuplicates(dups);
      setIsCheckingDuplicates(false);
      
      // Auto-select merge if high confidence match found
      if (dups.length > 0 && dups[0].matchScore >= 0.9) {
        setMergeChoice("merge");
        setMergeTargetId(dups[0].id);
        setMergeTargetType(dups[0].type);
      }
    };
    
    checkDups();
  }, [entity.id, onCheckDuplicates]);

  const updateField = (path: string, value: any) => {
    setFormData((prev) => {
      const newData = { ...prev };
      const parts = path.split(".");
      let current: any = newData;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
      return newData;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(entity.id, { edited_json: formData });
    setIsSaving(false);
    setHasChanges(false);
  };

  const handleApprove = async () => {
    // Save first if there are changes
    if (hasChanges) {
      await onUpdate(entity.id, { edited_json: formData });
    }
    
    setIsApproving(true);
    
    // Show progress steps
    if (duplicates.length > 0 && mergeChoice !== "create") {
      setApprovalStep("Checking for duplicates...");
      await new Promise(r => setTimeout(r, 500));
    }
    
    if (destination === "contact" || destination === "both") {
      setApprovalStep("Linking to company...");
      await new Promise(r => setTimeout(r, 500));
    }
    
    setApprovalStep(destination === "both" ? "Saving to Talent & Contacts..." : 
                    destination === "candidate" ? "Saving to Talent..." : "Saving to Contacts...");
    
    const options: ApprovalOptions = {
      destination,
      companyId: createNewCompany ? undefined : selectedCompanyId || undefined,
      companyName: createNewCompany ? newCompanyName : undefined,
      createNewCompany,
      addToOrgChart,
      mergeWithExisting: mergeChoice === "merge" ? mergeTargetId : undefined,
      mergeType: mergeChoice === "merge" ? mergeTargetType : undefined,
    };
    
    const result = await onApprove(entity.id, options);
    
    setApprovalStep("");
    setIsApproving(false);
    
    if (result.success) {
      setApprovalResult({
        candidateId: result.candidateId,
        contactId: result.contactId,
        companyId: result.companyId,
      });
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    await onReject(entity.id);
    setIsRejecting(false);
  };

  const isApproved = entity.status === "approved";
  const isRejected = entity.status === "rejected";
  const isDisabled = isApproved || isRejected;

  // Check for missing required fields
  const name = formData.personal?.full_name || formData.name;
  const hasMissingRequired = !name && entity.entity_type !== "note";
  
  // Check if company is required (destination includes contact)
  const needsCompany = (destination === "contact" || destination === "both") && 
                       !selectedCompanyId && !createNewCompany;

  return (
    <div className="h-full flex flex-col">
      {/* Form header */}
      <div className="p-6 border-b bg-card/50">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {name || "Untitled Entity"}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="capitalize">
                {entity.entity_type.replace("_", " ")}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  entity.confidence >= 0.8
                    ? "bg-green-500/10 text-green-500 border-green-500/30"
                    : entity.confidence >= 0.5
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                    : "bg-red-500/10 text-red-500 border-red-500/30"
                )}
              >
                {Math.round(entity.confidence * 100)}% confidence
              </Badge>
              {entity.file_name && (
                <span className="text-sm text-muted-foreground">
                  from {entity.file_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && !isDisabled && (
              <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2">Save</span>
              </Button>
            )}
            
            {!isDisabled && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="text-red-500 hover:text-red-600"
                >
                  {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  <span className="ml-2">Reject</span>
                </Button>
                
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isApproving || hasMissingRequired}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2">{approvalStep || "Approving..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="ml-2">Approve</span>
                    </>
                  )}
                </Button>
              </>
            )}

            {isApproved && (approvalResult || entity.created_record_id) && (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
              </div>
            )}

            {isRejected && (
              <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                <XCircle className="h-3 w-3 mr-1" />
                Rejected
              </Badge>
            )}
          </div>
        </div>

        {hasMissingRequired && !isDisabled && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-500">
              Name is required. Please fill in the name field before approving.
            </span>
          </div>
        )}

        {/* Post-approval links */}
        {isApproved && (approvalResult || entity.created_record_id) && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm font-medium text-green-600 mb-3">Successfully saved!</p>
              <div className="flex items-center gap-3 flex-wrap">
                {(approvalResult?.candidateId || entity.created_record_type === "candidate" || entity.created_record_type === "both") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/talent")}
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Open in Talent
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                {(approvalResult?.contactId || entity.created_record_type === "contact" || entity.created_record_type === "both") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/contacts")}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Open in Contacts
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                {approvalResult?.companyId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/companies")}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Open Company
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* AI Best Next Actions Panel - shows after approval */}
            <BestNextActionsPanel
              entityContext={{
                entityType: destination,
                entityId: entity.id,
                name: name || "Unknown",
                email: formData.contact?.email || formData.email,
                phone: formData.contact?.phones?.[0]?.number || formData.phone,
                title: formData.headline?.current_title || formData.title,
                headline: formData.headline?.current_title,
                skills: formData.skills?.primary_skills || formData.skills || [],
                experience: formData.experience || [],
                linkedIn: formData.contact?.linkedin || formData.linkedIn,
                location: formData.personal?.location || formData.location,
                company: selectedCompanyId 
                  ? { id: selectedCompanyId, name: companies.find(c => c.id === selectedCompanyId)?.name || "" }
                  : newCompanyName 
                    ? { name: newCompanyName }
                    : formData.headline?.current_company 
                      ? { name: formData.headline.current_company }
                      : undefined,
                cvAttached: !!entity.item_id,
              }}
            />
          </div>
        )}
      </div>

      {/* Form content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Destination selector - only for candidates */}
          {entity.entity_type === "candidate" && !isDisabled && (
            <section className="p-4 rounded-lg border bg-muted/30">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Store as
              </h3>
              <RadioGroup
                value={destination}
                onValueChange={(v) => setDestination(v as StoreDestination)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="candidate" id="dest-candidate" />
                  <Label htmlFor="dest-candidate" className="cursor-pointer">
                    Candidate (Talent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contact" id="dest-contact" />
                  <Label htmlFor="dest-contact" className="cursor-pointer">
                    Contact (Company)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="dest-both" />
                  <Label htmlFor="dest-both" className="cursor-pointer">
                    Both Candidate + Contact
                  </Label>
                </div>
              </RadioGroup>

              {/* Company selector when Contact or Both */}
              {(destination === "contact" || destination === "both") && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Select Company</Label>
                  </div>
                  
                  {!createNewCompany ? (
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose existing company..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter new company name..."
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                    />
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="create-company"
                      checked={createNewCompany}
                      onCheckedChange={(checked) => {
                        setCreateNewCompany(!!checked);
                        if (checked) setSelectedCompanyId("");
                      }}
                    />
                    <Label htmlFor="create-company" className="text-sm cursor-pointer">
                      Create new company instead
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="add-orgchart"
                      checked={addToOrgChart}
                      onCheckedChange={(checked) => setAddToOrgChart(!!checked)}
                    />
                    <Label htmlFor="add-orgchart" className="text-sm cursor-pointer">
                      Add to org chart
                    </Label>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Duplicate warning section */}
          {!isDisabled && duplicates.length > 0 && (
            <section className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                Potential Duplicates Found
              </h3>
              
              <div className="space-y-2 mb-4">
                {duplicates.slice(0, 3).map((dup) => (
                  <div
                    key={`${dup.type}-${dup.id}`}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      mergeChoice === "merge" && mergeTargetId === dup.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:bg-muted/50"
                    )}
                    onClick={() => {
                      setMergeChoice("merge");
                      setMergeTargetId(dup.id);
                      setMergeTargetType(dup.type);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{dup.name}</p>
                        {dup.email && (
                          <p className="text-sm text-muted-foreground">{dup.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">
                          {dup.type}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            dup.matchScore >= 0.9 ? "bg-red-500/10 text-red-600" : "bg-orange-500/10 text-orange-600"
                          )}
                        >
                          {dup.matchReason}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <RadioGroup
                value={mergeChoice}
                onValueChange={(v) => setMergeChoice(v as "create" | "merge" | "link")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="merge" id="dup-merge" />
                  <Label htmlFor="dup-merge" className="cursor-pointer flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    Merge into existing (update record with new data)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="dup-create" />
                  <Label htmlFor="dup-create" className="cursor-pointer flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create new anyway (keep both records)
                  </Label>
                </div>
              </RadioGroup>
            </section>
          )}

          {isCheckingDuplicates && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for duplicates...
            </div>
          )}

          {entity.entity_type === "candidate" && (
            <CandidateForm
              data={formData}
              onChange={updateField}
              disabled={isDisabled}
            />
          )}

          {entity.entity_type === "contact" && (
            <ContactForm
              data={formData}
              onChange={updateField}
              disabled={isDisabled}
            />
          )}

          {entity.entity_type === "note" && (
            <NoteForm
              data={formData}
              onChange={updateField}
              disabled={isDisabled}
            />
          )}

          {entity.entity_type === "org_node" && (
            <OrgNodeForm
              data={formData}
              onChange={updateField}
              disabled={isDisabled}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Candidate form
function CandidateForm({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, any>;
  onChange: (path: string, value: any) => void;
  disabled: boolean;
}) {
  const personal = data.personal || {};
  const headline = data.headline || {};
  const skills = data.skills || {};
  const experience = data.experience || [];
  const education = data.education || [];

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <section>
        <h3 className="font-medium mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={personal.full_name || data.name || ""}
              onChange={(e) => onChange("personal.full_name", e.target.value)}
              disabled={disabled}
              placeholder="Enter full name"
              autoFocus={autoFocusName}
            />
          </div>

          <div>
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <Input
              id="email"
              type="email"
              value={personal.email || ""}
              onChange={(e) => onChange("personal.email", e.target.value)}
              disabled={disabled}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" /> Phone
            </Label>
            <Input
              id="phone"
              value={personal.phone || ""}
              onChange={(e) => onChange("personal.phone", e.target.value)}
              disabled={disabled}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Location
            </Label>
            <Input
              id="location"
              value={personal.location || ""}
              onChange={(e) => onChange("personal.location", e.target.value)}
              disabled={disabled}
              placeholder="City, Country"
            />
          </div>

          <div>
            <Label htmlFor="linkedin" className="flex items-center gap-2">
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </Label>
            <Input
              id="linkedin"
              value={personal.linkedin || ""}
              onChange={(e) => onChange("personal.linkedin", e.target.value)}
              disabled={disabled}
              placeholder="linkedin.com/in/..."
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Headline */}
      <section>
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Current Role
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={headline.current_title || ""}
              onChange={(e) => onChange("headline.current_title", e.target.value)}
              disabled={disabled}
              placeholder="e.g., Senior Software Engineer"
            />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={headline.current_company || ""}
              onChange={(e) => onChange("headline.current_company", e.target.value)}
              disabled={disabled}
              placeholder="e.g., Acme Corp"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Skills */}
      <section>
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Award className="h-4 w-4" /> Skills
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Primary Skills</Label>
            <Input
              value={(skills.primary_skills || []).join(", ")}
              onChange={(e) =>
                onChange(
                  "skills.primary_skills",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              disabled={disabled}
              placeholder="React, TypeScript, Node.js"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate skills with commas
            </p>
          </div>
          <div>
            <Label>Secondary Skills</Label>
            <Input
              value={(skills.secondary_skills || []).join(", ")}
              onChange={(e) =>
                onChange(
                  "skills.secondary_skills",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              disabled={disabled}
              placeholder="AWS, Docker, GraphQL"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Experience */}
      {experience.length > 0 && (
        <section>
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Experience
          </h3>
          <div className="space-y-3">
            {experience.map((exp: any, idx: number) => (
              <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                <div className="font-medium">{exp.title || exp.role}</div>
                <div className="text-sm text-muted-foreground">{exp.company}</div>
                {exp.duration && (
                  <div className="text-xs text-muted-foreground mt-1">{exp.duration}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <section>
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Education
          </h3>
          <div className="space-y-3">
            {education.map((edu: any, idx: number) => (
              <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                <div className="font-medium">{edu.degree}</div>
                <div className="text-sm text-muted-foreground">{edu.institution}</div>
                {edu.year && (
                  <div className="text-xs text-muted-foreground mt-1">{edu.year}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Contact form
function ContactForm({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, any>;
  onChange: (path: string, value: any) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-4">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={data.name || data.full_name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              disabled={disabled}
              placeholder="Enter full name"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={data.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={data.phone || ""}
              onChange={(e) => onChange("phone", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div>
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={data.title || data.job_title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={data.department || ""}
              onChange={(e) => onChange("department", e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={data.company || ""}
              onChange={(e) => onChange("company", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Note form
function NoteForm({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, any>;
  onChange: (path: string, value: any) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-4">Meeting Notes</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={data.summary || ""}
              onChange={(e) => onChange("summary", e.target.value)}
              disabled={disabled}
              rows={4}
              placeholder="Meeting summary..."
            />
          </div>

          {data.participants && (
            <div>
              <Label>Participants</Label>
              <Input
                value={(data.participants || []).join(", ")}
                onChange={(e) =>
                  onChange(
                    "participants",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                disabled={disabled}
              />
            </div>
          )}

          {data.action_items && data.action_items.length > 0 && (
            <div>
              <Label>Action Items</Label>
              <div className="space-y-2 mt-2">
                {data.action_items.map((item: any, idx: number) => (
                  <div key={idx} className="p-2 border rounded bg-muted/30 text-sm">
                    {typeof item === "string" ? item : item.description}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Org Node form
function OrgNodeForm({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, any>;
  onChange: (path: string, value: any) => void;
  disabled: boolean;
}) {
  const nodes = data.nodes || [];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-4">Organization Chart</h3>
        {nodes.length > 0 ? (
          <div className="space-y-3">
            {nodes.map((node: any, idx: number) => (
              <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                <div className="font-medium">{node.name}</div>
                <div className="text-sm text-muted-foreground">{node.title}</div>
                {node.reports_to && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Reports to: {node.reports_to}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No org chart nodes detected</p>
        )}
      </section>
    </div>
  );
}
