import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Contact } from "@/lib/types";
import { departmentOptions, jobTitleOptionsFlat, seniorityOptions } from "@/lib/dropdown-options";
import { toast } from "sonner";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddContact: (contact: Contact) => void;
  companyName: string;
}

export const AddContactModal = ({
  open,
  onOpenChange,
  onAddContact,
  companyName,
}: AddContactModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [seniority, setSeniority] = useState<string>("");
  const [reportsTo, setReportsTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setDepartment("");
    setCustomDepartment("");
    setJobTitle("");
    setCustomJobTitle("");
    setSeniority("");
    setReportsTo("");
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    const finalDepartment = department === "other" ? customDepartment : department;
    const finalJobTitle = jobTitle === "other" ? customJobTitle : jobTitle;

    if (!finalDepartment) {
      newErrors.department = "Department is required to map this contact to the organisation chart";
    }

    if (!finalJobTitle) {
      newErrors.jobTitle = "Job Title is required to map this contact to the organisation chart";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const finalDepartment = department === "other" ? customDepartment : department;
    const finalJobTitle = jobTitle === "other" ? customJobTitle : jobTitle;
    const finalSeniority = seniority || "mid";

    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: finalDepartment,
      title: finalJobTitle,
      seniority: finalSeniority as Contact["seniority"],
      status: "new",
      reportsTo: reportsTo || undefined,
      lastContact: new Date().toISOString().split("T")[0],
    };

    onAddContact(newContact);
    toast.success(`${name} added to the org chart`);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} modal={false}>
      <DialogContent className="sm:max-w-[425px] shadow-2xl border border-border/50 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Add Contact to {companyName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Department */}
          <div className="grid gap-2">
            <Label htmlFor="department">Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
                <SelectItem value="other">Other (custom)</SelectItem>
              </SelectContent>
            </Select>
            {department === "other" && (
              <Input
                value={customDepartment}
                onChange={(e) => setCustomDepartment(e.target.value)}
                placeholder="Enter custom department"
              />
            )}
            {errors.department && (
              <p className="text-sm text-destructive">{errors.department}</p>
            )}
          </div>

          {/* Job Title */}
          <div className="grid gap-2">
            <Label htmlFor="jobTitle">Job Title *</Label>
            <Select value={jobTitle} onValueChange={setJobTitle}>
              <SelectTrigger>
                <SelectValue placeholder="Select job title" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {jobTitleOptionsFlat.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
                <SelectItem value="other">Other (custom)</SelectItem>
              </SelectContent>
            </Select>
            {jobTitle === "other" && (
              <Input
                value={customJobTitle}
                onChange={(e) => setCustomJobTitle(e.target.value)}
                placeholder="Enter custom job title"
              />
            )}
            {errors.jobTitle && (
              <p className="text-sm text-destructive">{errors.jobTitle}</p>
            )}
          </div>

          {/* Seniority */}
          <div className="grid gap-2">
            <Label htmlFor="seniority">Seniority</Label>
            <Select value={seniority} onValueChange={setSeniority}>
              <SelectTrigger>
                <SelectValue placeholder="Select seniority (optional)" />
              </SelectTrigger>
              <SelectContent>
                {seniorityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@company.com"
            />
          </div>

          {/* Phone */}
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add to Org Chart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
