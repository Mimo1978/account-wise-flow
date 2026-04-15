import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FastCVUpload } from "@/components/import/FastCVUpload";
import { ImportCenterModal } from "@/components/import/ImportCenterModal";
import { cn } from "@/lib/utils";
import {
  FileText, Table2, Building2, Users, Upload,
  ChevronRight, CheckCircle2, Sparkles
} from "lucide-react";

const IMPORT_OPTIONS = [
  {
    id: "cvs",
    icon: FileText,
    title: "Upload CVs / Resumes",
    description: "Drag and drop PDF or Word CVs. AI reads each one and creates a candidate profile automatically — name, skills, experience, company history all extracted.",
    badge: "Most popular",
    badgeColor: "bg-amber-500/20 text-amber-600",
    action: "upload_cvs",
  },
  {
    id: "spreadsheet",
    icon: Table2,
    title: "Import from spreadsheet",
    description: "Export from Bullhorn, Vincere, or any other system as CSV or Excel. Map your columns to our fields in seconds.",
    badge: "From another CRM",
    badgeColor: "bg-blue-500/20 text-blue-600",
    action: "import_csv",
  },
  {
    id: "companies",
    icon: Building2,
    title: "Import companies & contacts",
    description: "Bring in your client list. CSV or paste directly. Matches against existing records to avoid duplicates.",
    badge: "Client data",
    badgeColor: "bg-green-500/20 text-green-600",
    action: "import_companies",
  },
];

const WHAT_HAPPENS = [
  { step: 1, label: "You upload", desc: "CVs, spreadsheets, or paste data" },
  { step: 2, label: "AI reads it", desc: "Extracts every field — no manual entry" },
  { step: 3, label: "You review", desc: "Spot-check before anything is saved" },
  { step: 4, label: "Data is live", desc: "Search, match, and place immediately" },
];

export default function DataOnboarding() {
  const navigate = useNavigate();
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const handleAction = (action: string) => {
    if (action === "upload_cvs") setCvUploadOpen(true);
    if (action === "import_csv") setCsvOpen(true);
    if (action === "import_companies") setCompaniesOpen(true);
  };

  const markDone = (id: string) => setDone(prev => [...prev, id]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">

      <div className="w-full max-w-2xl space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">

          <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" />
            Getting started
          </div>

          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Bring your data into Client Mapper
          </h1>

          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Import your existing CVs, candidate records, and client data in minutes.
            AI handles the extraction — no manual entry, no reformatting.
          </p>

        </div>

        {/* How it works */}
        <div className="flex items-start justify-center gap-6">
          {WHAT_HAPPENS.map((s, i) => (
            <div key={s.step} className="flex items-start gap-3">

              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {s.step}
                </div>
                {i < WHAT_HAPPENS.length - 1 && (
                  <div className="w-px h-4 bg-border mt-1" />
                )}
              </div>

              <div className="pt-1">
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
              </div>

            </div>
          ))}
        </div>

        {/* Import options */}
        <div className="space-y-3">
          {IMPORT_OPTIONS.map(opt => {
            const isDone = done.includes(opt.id);
            return (
              <Card key={opt.id} className={cn("cursor-pointer transition-all hover:border-primary/40", isDone && "opacity-60 cursor-default")} onClick={() => !isDone && handleAction(opt.action)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">

                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {isDone
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <opt.icon className="h-5 w-5 text-muted-foreground" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{opt.title}</p>
                        <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", opt.badgeColor)}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>

                    {!isDone && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Large volume notice */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Upload className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  Importing thousands of CVs?
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  For large migrations (500+ CVs), contact us and we will run a bulk import directly.
                  We support up to 20,000 CVs per batch with automatic deduplication and AI parsing.
                  All CVs are anonymised before AI processing — names and contact details are stored
                  separately and only shown when you choose to reveal a candidate.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => navigate("/talent")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now — go to Talent →
          </button>
          <Button onClick={() => navigate("/home")} size="sm">
            Go to Command Centre →
          </Button>
        </div>
      </div>

      <FastCVUpload
        open={cvUploadOpen}
        onOpenChange={setCvUploadOpen}
        onComplete={() => { markDone("cvs"); setCvUploadOpen(false); }}
      />

      <ImportCenterModal open={csvOpen} onOpenChange={setCsvOpen} entityType="talent" onImportComplete={() => { markDone("spreadsheet"); setCsvOpen(false); }} />

      <ImportCenterModal open={companiesOpen} onOpenChange={setCompaniesOpen} entityType="companies" onImportComplete={() => { markDone("companies"); setCompaniesOpen(false); }} />
    </div>
  );
}
