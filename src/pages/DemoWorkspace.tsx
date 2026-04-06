import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users, FlaskConical, RotateCcw, ArrowLeft, Loader2 } from "lucide-react";
import { AccountCanvas, AccountCanvasRef } from "@/components/canvas/AccountCanvas";
import { ContactDetailPanel } from "@/components/canvas/ContactDetailPanel";
import { CompanySwitcher } from "@/components/canvas/CompanySwitcher";
import { QRCodeButton } from "@/components/canvas/QRCodeButton";
import { AddContactModal } from "@/components/canvas/AddContactModal";
import { SmartImportModal } from "@/components/import/SmartImportModal";
import { CompanyDatabaseView } from "@/components/canvas/CompanyDatabaseView";
import { AIKnowledgePanel } from "@/components/canvas/AIKnowledgePanel";
import { AIInsightsPanel } from "@/components/canvas/AIInsightsPanel";
import { AIRoleSuggestionsPanel } from "@/components/canvas/AIRoleSuggestionsPanel";
import { GlobalSearch } from "@/components/canvas/GlobalSearch";
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import { mockTalents, mockEngagements } from "@/lib/mock-talent";
import { Account, Contact, Talent, TalentEngagement } from "@/lib/types";
import { TalentProfilePanel } from "@/components/talent/TalentProfilePanel";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDemoWorkspace } from "@/hooks/use-demo-workspace";
import { DemoBanner } from "@/components/layout/DemoBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Authenticated Demo Workspace
 * 
 * This page provides full feature access in a sandboxed demo environment.
 * - Requires authentication (protected route)
 * - Uses demo team/workspace data isolated by RLS
 * - All CRUD operations work but only affect demo data
 * - Real customer data is never accessible from this route
 */
const DemoWorkspace = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    isDemoUser, 
    companies: demoCompanies, 
    contacts: demoContacts, 
    isLoading: isDemoLoading,
    isResetting,
    resetDemoData,
  } = useDemoWorkspace();
  
  const [account, setAccount] = useState(mockAccount);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<Account | null>(null);
  const [showCompanySaveDialog, setShowCompanySaveDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"canvas" | "database">("canvas");
  const [isAIKnowledgeOpen, setIsAIKnowledgeOpen] = useState(false);
  const [isAIInsightsOpen, setIsAIInsightsOpen] = useState(false);
  const [isRoleSuggestionsOpen, setIsRoleSuggestionsOpen] = useState(false);
  const [highlightedContactIds, setHighlightedContactIds] = useState<string[]>([]);
  const [showTalentOverlay, setShowTalentOverlay] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [showTalentPanel, setShowTalentPanel] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const canvasRef = useRef<AccountCanvasRef>(null);

  // Handle reset demo data
  const handleResetDemo = async () => {
    await resetDemoData();
    setShowResetDialog(false);
  };

  // Get engagements for current company with talent data
  const companyEngagements = mockEngagements
    .filter((eng) => eng.companyId === account.id)
    .map((eng) => ({
      ...eng,
      talent: mockTalents.find((t) => t.id === eng.talentId),
    }))
    .filter((eng) => eng.talent) as (TalentEngagement & { talent: Talent })[];

  const handleCompanySwitch = (newAccount: Account) => {
    if (hasUnsavedChanges) {
      setPendingCompany(newAccount);
      setShowCompanySaveDialog(true);
    } else {
      performCompanySwitch(newAccount);
    }
  };

  const performCompanySwitch = (newAccount: Account) => {
    setSelectedContact(null);
    setIsExpanded(false);
    setHasUnsavedChanges(false);
    canvasRef.current?.clearSearch();
    setAccount(newAccount);
    toast.success(`Switched to ${newAccount.name}`);
  };

  const handleCompanySaveAndSwitch = () => {
    toast.success("Changes saved");
    if (pendingCompany) {
      performCompanySwitch(pendingCompany);
    }
    setPendingCompany(null);
    setShowCompanySaveDialog(false);
  };

  const handleCompanyDiscardAndSwitch = () => {
    if (pendingCompany) {
      performCompanySwitch(pendingCompany);
    }
    setPendingCompany(null);
    setShowCompanySaveDialog(false);
  };

  const handleCompanyCancelSwitch = () => {
    setPendingCompany(null);
    setShowCompanySaveDialog(false);
  };

  const handleContactClick = (contact: Contact) => {
    if (selectedContact?.id === contact.id) return;
    if (hasUnsavedChanges) {
      setPendingContact(contact);
      setShowSaveDialog(true);
    } else {
      setSelectedContact(contact);
      setIsExpanded(false);
    }
  };

  const handleSaveAndSwitch = () => {
    toast.success("Changes saved");
    setSelectedContact(pendingContact);
    setPendingContact(null);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);
    setIsExpanded(false);
  };

  const handleDiscardAndSwitch = () => {
    setSelectedContact(pendingContact);
    setPendingContact(null);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);
    setIsExpanded(false);
  };

  const handleCancelSwitch = () => {
    setPendingContact(null);
    setShowSaveDialog(false);
  };

  const handleClosePanel = () => {
    setSelectedContact(null);
    setIsExpanded(false);
    setHasUnsavedChanges(false);
  };

  const handleAddContact = (contact: Contact) => {
    setAccount((prev) => ({
      ...prev,
      contacts: [...prev.contacts, contact],
    }));
    toast.success(`Contact "${contact.name}" added to demo workspace`);
  };

  const handleHighlightContacts = useCallback((contactIds: string[]) => {
    setHighlightedContactIds(contactIds);
    canvasRef.current?.highlightContacts(contactIds);
  }, []);

  const handleGlobalSelectCompany = useCallback((selectedAccount: Account) => {
    if (hasUnsavedChanges) {
      setPendingCompany(selectedAccount);
      setShowCompanySaveDialog(true);
    } else {
      performCompanySwitch(selectedAccount);
    }
  }, [hasUnsavedChanges]);

  const handleGlobalSelectContact = useCallback((contact: Contact, selectedAccount: Account) => {
    if (selectedAccount.id !== account.id) {
      if (hasUnsavedChanges) {
        toast.info("Please save or discard changes before switching companies");
        return;
      }
      performCompanySwitch(selectedAccount);
    }
    setSelectedContact(contact);
    setViewMode("canvas");
    setIsExpanded(false);
    canvasRef.current?.highlightContacts([contact.id]);
    setHighlightedContactIds([contact.id]);
  }, [account.id, hasUnsavedChanges]);

  const handleTalentClick = useCallback((talent: Talent, engagement: TalentEngagement) => {
    setSelectedTalent(talent);
    setShowTalentPanel(true);
  }, []);

  const handleCloseTalentPanel = () => {
    setSelectedTalent(null);
    setShowTalentPanel(false);
  };

  // Show loading state
  if (isDemoLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-65px)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading demo workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Demo Workspace Banner - Using unified component */}
      <DemoBanner 
        variant="authenticated" 
        onReset={() => setShowResetDialog(true)}
        isResetting={isResetting}
      />

      {/* Sub-header with context controls */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold">{account.name}</h1>
              <p className="text-sm text-muted-foreground">{account.industry}</p>
            </div>
            <div className="h-6 w-px bg-border" />
            <CompanySwitcher 
              currentCompany={account.name}
              companies={mockAccounts}
              onCompanySelect={handleCompanySwitch}
            />
            <QRCodeButton 
              accountId={account.id}
              accountName={account.name}
            />
            <div className="h-6 w-px bg-border" />
            <GlobalSearch
              onSelectCompany={handleGlobalSelectCompany}
              onSelectContact={handleGlobalSelectContact}
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Talent Overlay Toggle */}
            {viewMode === "canvas" && companyEngagements.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/50">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="talent-overlay" className="text-sm cursor-pointer">
                  Talent Overlay
                </Label>
                <Switch
                  id="talent-overlay"
                  checked={showTalentOverlay}
                  onCheckedChange={setShowTalentOverlay}
                />
                {showTalentOverlay && (
                  <span className="text-xs text-muted-foreground">
                    ({companyEngagements.length})
                  </span>
                )}
              </div>
            )}
            {viewMode === "canvas" && companyEngagements.length > 0 && (
              <div className="h-6 w-px bg-border" />
            )}
            
            {/* View Toggle */}
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "canvas" | "database")}>
              <ToggleGroupItem value="canvas" aria-label="Canvas view" className="gap-2">
                <Network className="w-4 h-4" />
                Canvas
              </ToggleGroupItem>
              <ToggleGroupItem value="database" aria-label="Database view" className="gap-2">
                <Table2 className="w-4 h-4" />
                Database
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="h-6 w-px bg-border" />
            <Button 
              variant={isRoleSuggestionsOpen ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setIsRoleSuggestionsOpen(!isRoleSuggestionsOpen)}
            >
              <UserPlus className="w-4 h-4" />
              Missing Roles
            </Button>
            <Button 
              variant={isAIInsightsOpen ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setIsAIInsightsOpen(!isAIInsightsOpen)}
            >
              <Lightbulb className="w-4 h-4" />
              AI Insights
            </Button>
            <Button 
              variant={isAIKnowledgeOpen ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setIsAIKnowledgeOpen(!isAIKnowledgeOpen)}
            >
              <Brain className="w-4 h-4" />
              AI Knowledge
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAIImportModal(true)}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import Contacts</TooltipContent>
            </Tooltip>
            <Button size="sm" className="gap-2" onClick={() => setShowAddContactModal(true)}>
              <Plus className="w-4 h-4" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative pointer-events-auto">
        {viewMode === "canvas" ? (
          <AccountCanvas 
            ref={canvasRef}
            account={account} 
            onContactClick={handleContactClick}
            onTalentClick={handleTalentClick}
            highlightedContactIds={highlightedContactIds}
            showTalentOverlay={showTalentOverlay}
            talentEngagements={companyEngagements}
          />
        ) : (
          <CompanyDatabaseView
            account={account}
            allAccounts={mockAccounts}
            onAccountUpdate={setAccount}
            onViewCanvas={() => setViewMode("canvas")}
            onAddContact={() => setShowAddContactModal(true)}
            onAIImport={() => setShowAIImportModal(true)}
          />
        )}
      </main>

      {/* Floating Contact Panel */}
      {viewMode === "canvas" && selectedContact && (
        <ContactDetailPanel 
          contact={selectedContact} 
          onClose={handleClosePanel}
          isExpanded={isExpanded}
          onExpandToggle={() => setIsExpanded(!isExpanded)}
          onUnsavedChanges={setHasUnsavedChanges}
          originPath="/demo-workspace"
          originLabel="Back to Demo"
        />
      )}

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes Before Switching?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for this contact. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardAndSwitch}>
              Discard & Switch
            </Button>
            <AlertDialogAction onClick={handleSaveAndSwitch}>
              Save & Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Company Switch Save Confirmation Dialog */}
      <AlertDialog open={showCompanySaveDialog} onOpenChange={setShowCompanySaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes Before Switching Company?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. What would you like to do before switching to {pendingCompany?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCompanyCancelSwitch}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleCompanyDiscardAndSwitch}>
              Discard & Switch
            </Button>
            <AlertDialogAction onClick={handleCompanySaveAndSwitch}>
              Save & Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Contact Modal */}
      <AddContactModal
        open={showAddContactModal}
        onOpenChange={setShowAddContactModal}
        onAddContact={handleAddContact}
        companyName={account.name}
      />

      {/* Smart Import Modal */}
      <SmartImportModal
        open={showAIImportModal}
        onOpenChange={setShowAIImportModal}
        context={{
          source: 'CANVAS',
          companyId: account.id,
          companyName: account.name,
        }}
      />

      {/* AI Knowledge Panel */}
      {viewMode === "canvas" && (
        <AIKnowledgePanel
          account={account}
          isOpen={isAIKnowledgeOpen}
          onToggle={() => setIsAIKnowledgeOpen(!isAIKnowledgeOpen)}
          onHighlightContacts={handleHighlightContacts}
        />
      )}

      {/* AI Insights Panel */}
      {viewMode === "canvas" && (
        <AIInsightsPanel
          account={account}
          isOpen={isAIInsightsOpen}
          onToggle={() => setIsAIInsightsOpen(!isAIInsightsOpen)}
          onHighlightContacts={handleHighlightContacts}
        />
      )}

      {/* AI Role Suggestions Panel */}
      {viewMode === "canvas" && (
        <AIRoleSuggestionsPanel
          account={account}
          isOpen={isRoleSuggestionsOpen}
          onToggle={() => setIsRoleSuggestionsOpen(!isRoleSuggestionsOpen)}
          onAddContact={handleAddContact}
        />
      )}

      {/* Talent Profile Panel */}
      <TalentProfilePanel
        talent={selectedTalent}
        open={showTalentPanel}
        onClose={handleCloseTalentPanel}
      />

      {/* Bottom Info Bar */}
      {viewMode === "canvas" && (
        <div className="border-t border-border/50 bg-muted/30 px-6 py-3">
          <div className="container mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-champion" />
                <span className="text-muted-foreground">Champion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-engaged" />
                <span className="text-muted-foreground">Engaged</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-neutral" />
                <span className="text-muted-foreground">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-disengaged" />
                <span className="text-muted-foreground">Disengaged</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-new" />
                <span className="text-muted-foreground">New Contact</span>
              </div>
            </div>
            <div className="text-muted-foreground">
              {account.contacts.length} contacts • Click to view details
            </div>
          </div>
        </div>
      )}

      {/* Reset Demo Data Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Demo Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your demo contacts, companies, and notes created in the demo workspace.
              The workspace will be reset to its default sample data state.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetDemo}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Reset Demo Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DemoWorkspace;