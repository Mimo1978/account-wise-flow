import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users } from "lucide-react";
import { AccountCanvas, AccountCanvasRef } from "@/components/canvas/AccountCanvas";
import { ContactDetailPanel } from "@/components/canvas/ContactDetailPanel";
import { CompanySwitcher } from "@/components/canvas/CompanySwitcher";
import { QRCodeButton } from "@/components/canvas/QRCodeButton";
import { AddContactModal } from "@/components/canvas/AddContactModal";
import { AIImportModal } from "@/components/canvas/AIImportModal";
import { CompanyDatabaseView } from "@/components/canvas/CompanyDatabaseView";
import { AIKnowledgePanel } from "@/components/canvas/AIKnowledgePanel";
import { AIInsightsPanel } from "@/components/canvas/AIInsightsPanel";
import { AIRoleSuggestionsPanel } from "@/components/canvas/AIRoleSuggestionsPanel";
import { GlobalSearch } from "@/components/canvas/GlobalSearch";
import { ResponsiveToolbar, ToolbarAction } from "@/components/canvas/ResponsiveToolbar";
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import { mockTalents, mockEngagements } from "@/lib/mock-talent";
import { Account, Contact, Talent, TalentEngagement } from "@/lib/types";
import { TalentProfilePanel } from "@/components/talent/TalentProfilePanel";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { GuidedTooltips } from "@/components/onboarding/GuidedTooltips";
import { useOnboarding } from "@/hooks/use-onboarding";

const Canvas = () => {
  const {
    showOnboardingModal,
    showTooltips,
    completeOnboarding,
    skipOnboarding,
    completeTooltips,
    dismissTooltips,
  } = useOnboarding();
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
  const canvasRef = useRef<AccountCanvasRef>(null);

  // Get engagements for current company with talent data
  const companyEngagements = mockEngagements
    .filter((eng) => eng.companyId === account.id)
    .map((eng) => ({
      ...eng,
      talent: mockTalents.find((t) => t.id === eng.talentId),
    }))
    .filter((eng) => eng.talent) as (TalentEngagement & { talent: Talent })[];

  const handleCompanySwitch = (newAccount: Account) => {
    // If there are unsaved changes, show confirmation dialog
    if (hasUnsavedChanges) {
      setPendingCompany(newAccount);
      setShowCompanySaveDialog(true);
    } else {
      performCompanySwitch(newAccount);
    }
  };

  const performCompanySwitch = (newAccount: Account) => {
    // Clear any open contact card
    setSelectedContact(null);
    setIsExpanded(false);
    setHasUnsavedChanges(false);
    
    // Reset the canvas search
    canvasRef.current?.clearSearch();
    
    // Load the new account
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
    // If clicking the same contact, do nothing
    if (selectedContact?.id === contact.id) return;

    // If there are unsaved changes, show confirmation dialog
    if (hasUnsavedChanges) {
      setPendingContact(contact);
      setShowSaveDialog(true);
    } else {
      setSelectedContact(contact);
      setIsExpanded(false);
    }
  };

  const handleSaveAndSwitch = () => {
    // In real implementation, save the changes here
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
  };

  const handleHighlightContacts = useCallback((contactIds: string[]) => {
    setHighlightedContactIds(contactIds);
    // Also call the canvas method directly for immediate visual feedback
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
    // If the contact is from a different company, switch to that company first
    if (selectedAccount.id !== account.id) {
      if (hasUnsavedChanges) {
        toast.info("Please save or discard changes before switching companies");
        return;
      }
      performCompanySwitch(selectedAccount);
    }
    
    // Set the selected contact and switch to canvas view
    setSelectedContact(contact);
    setViewMode("canvas");
    setIsExpanded(false);
    
    // Highlight the contact on the canvas
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

  // Build toolbar actions with proper priority grouping
  const toolbarActions: ToolbarAction[] = useMemo(() => {
    const actions: ToolbarAction[] = [];

    // Secondary actions (can overflow into "More" menu)
    actions.push({
      id: "missing-roles",
      label: "Missing Roles",
      icon: <UserPlus className="w-4 h-4" />,
      onClick: () => setIsRoleSuggestionsOpen(!isRoleSuggestionsOpen),
      isActive: isRoleSuggestionsOpen,
      priority: "secondary",
    });

    actions.push({
      id: "ai-insights",
      label: "AI Insights",
      icon: <Lightbulb className="w-4 h-4" />,
      onClick: () => setIsAIInsightsOpen(!isAIInsightsOpen),
      isActive: isAIInsightsOpen,
      priority: "secondary",
    });

    actions.push({
      id: "ai-knowledge",
      label: "AI Knowledge",
      icon: <Brain className="w-4 h-4" />,
      onClick: () => setIsAIKnowledgeOpen(!isAIKnowledgeOpen),
      isActive: isAIKnowledgeOpen,
      priority: "secondary",
    });

    // Critical actions (always visible)
    actions.push({
      id: "import",
      label: "Import Contacts",
      icon: <Upload className="w-4 h-4" />,
      onClick: () => setShowAIImportModal(true),
      priority: "critical",
      hideLabel: true,
    });

    actions.push({
      id: "add-contact",
      label: "Add Contact",
      icon: <Plus className="w-4 h-4" />,
      onClick: () => setShowAddContactModal(true),
      variant: "default",
      priority: "critical",
    });

    return actions;
  }, [isRoleSuggestionsOpen, isAIInsightsOpen, isAIKnowledgeOpen]);

  // Left side content for the toolbar
  const toolbarLeftContent = (
    <>
      <div className="min-w-0 shrink-0">
        <h1 className="text-lg font-bold truncate">{account.name}</h1>
        <p className="text-sm text-muted-foreground truncate">{account.industry}</p>
      </div>
      <div className="h-6 w-px bg-border shrink-0" />
      <CompanySwitcher 
        currentCompany={account.name}
        onCompanySelect={handleCompanySwitch}
      />
      <QRCodeButton 
        accountId={account.id}
        accountName={account.name}
      />
      <div className="h-6 w-px bg-border shrink-0" />
      <GlobalSearch
        onSelectCompany={handleGlobalSelectCompany}
        onSelectContact={handleGlobalSelectContact}
      />
      <div className="h-6 w-px bg-border shrink-0" />
      
      {/* Talent Overlay Toggle - Only show in canvas mode */}
      {viewMode === "canvas" && companyEngagements.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/50 shrink-0">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="talent-overlay" className="text-sm cursor-pointer whitespace-nowrap">
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
          <div className="h-6 w-px bg-border shrink-0" />
        </>
      )}
      
      {/* View Toggle */}
      <ToggleGroup 
        type="single" 
        value={viewMode} 
        onValueChange={(value) => value && setViewMode(value as "canvas" | "database")}
        className="shrink-0"
      >
        <ToggleGroupItem value="canvas" aria-label="Canvas view" className="gap-2">
          <Network className="w-4 h-4" />
          <span className="hidden lg:inline">Canvas</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="database" aria-label="Database view" className="gap-2">
          <Table2 className="w-4 h-4" />
          <span className="hidden lg:inline">Database</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Sub-header with context controls */}
      <div 
        data-toolbar-ribbon
        className="border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3 overflow-hidden"
      >
        <ResponsiveToolbar
          leftContent={toolbarLeftContent}
          actions={toolbarActions}
        />
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

      {/* Floating Contact Panel - Only show in canvas mode */}
      {viewMode === "canvas" && selectedContact && (
        <ContactDetailPanel 
          contact={selectedContact} 
          onClose={handleClosePanel}
          isExpanded={isExpanded}
          onExpandToggle={() => setIsExpanded(!isExpanded)}
          onUnsavedChanges={setHasUnsavedChanges}
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

      {/* AI Import Modal */}
      <AIImportModal
        open={showAIImportModal}
        onOpenChange={setShowAIImportModal}
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

      {/* Bottom Info Bar - Only show in canvas mode */}
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
                <div className="w-3 h-3 rounded-full bg-node-warm" />
                <span className="text-muted-foreground">Warm</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-node-blocker" />
                <span className="text-muted-foreground">Blocker</span>
              </div>
            </div>
            <p className="text-muted-foreground">
              Drag nodes to reposition • Click to see details
            </p>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal
        open={showOnboardingModal}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />

      {/* Guided Tooltips */}
      {showTooltips && (
        <GuidedTooltips
          onComplete={completeTooltips}
          onDismiss={dismissTooltips}
        />
      )}
    </div>
  );
};

export default Canvas;
