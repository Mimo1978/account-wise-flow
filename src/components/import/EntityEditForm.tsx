import { useState, useEffect } from "react";
import { ImportEntity, ImportEntityStatus } from "@/hooks/use-import-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EntityEditFormProps {
  entity: ImportEntity;
  onUpdate: (entityId: string, updates: Partial<ImportEntity>) => Promise<boolean>;
  onApprove: (entityId: string) => Promise<{ success: boolean; recordId?: string; recordType?: string; error?: string }>;
  onReject: (entityId: string, reason?: string) => Promise<boolean>;
}

export function EntityEditForm({ entity, onUpdate, onApprove, onReject }: EntityEditFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data from entity
  useEffect(() => {
    const data = entity.edited_json || entity.extracted_json;
    setFormData(JSON.parse(JSON.stringify(data)));
    setHasChanges(false);
  }, [entity]);

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
    await onApprove(entity.id);
    setIsApproving(false);
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
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span className="ml-2">Approve</span>
                </Button>
              </>
            )}

            {isApproved && entity.created_record_id && (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Saved to {entity.created_record_type}
              </Badge>
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
      </div>

      {/* Form content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
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
