import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users, GitBranch, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { ResponsiveToolbar, ToolbarAction } from "@/components/canvas/ResponsiveToolbar";
import { OrgChartBuilderModal } from "@/components/orgchart/OrgChartBuilderModal";
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import { mockTalents, mockEngagements } from "@/lib/mock-talent";
import { Account, Contact, Talent, TalentEngagement } from "@/lib/types";
import { TalentProfilePanel } from "@/components/talent/TalentProfilePanel";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { useCompanyCanvas } from "@/hooks/use-company-canvas";
import { useCanvasMode } from "@/hooks/use-canvas-mode";
import { CanvasModeToggle } from "@/components/canvas/CanvasModeToggle";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOrgChartEdges, DropZone } from "@/hooks/use-org-chart-edges";

const Canvas = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    showOnboardingModal,
    showTooltips,
    completeOnboarding,
    skipOnboarding,
    completeTooltips,
    dismissTooltips,
  } = useOnboarding();
  
  const { currentWorkspace } = useWorkspace();
  const { 
    account: loadedAccount, 
    accounts: allAccounts, 
    isLoading: isLoadingCompany,
    switchCompany,
    isUsingMockData,
    setAccount: setLoadedAccount,
  } = useCompanyCanvas({ fallbackToMock: true });
  
  const [account, setAccount] = useState<Account | null>(null);
  
  useEffect(() => {
    if (loadedAccount) {
      setAccount(loadedAccount);
    }
  }, [loadedAccount]);

  // Org chart edges hook — single source of truth for hierarchy
  const {
    edges: orgChartEdges,
    parentMap: edgeParentMap,
    childrenMap: edgeChildrenMap,
    rootContactId,
    setParent,
    insertAsSibling,
    insertAsParent,
    wouldCreateCycle,
  } = useOrgChartEdges({ companyId: account?.id });

  // Handle highlight param from navigation
  useEffect(() => {
    const highlightParam = searchParams.get("highlight");
    if (highlightParam && account) {
      const ids = highlightParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        setHighlightedContactIds(ids);
        setViewMode("canvas");
        setTimeout(() => {
          canvasRef.current?.highlightContacts(ids);
        }, 500);
        setTimeout(() => setHighlightedContactIds([]), 10000);
        toast.success(`${ids.length} contacts imported and displayed on canvas`);
        searchParams.delete("highlight");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, account]);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [showOrgChartBuilder, setShowOrgChartBuilder] = useState(false);
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
  
  const {
    mode: canvasMode,
    isEditMode,
    setMode: setCanvasMode,
    selectedNodeId,
    setSelectedNodeId,
  } = useCanvasMode();

  const companyEngagements = account ? mockEngagements
    .filter((eng) => eng.companyId === account.id)
    .map((eng) => ({
      ...eng,
      talent: mockTalents.find((t) => t.id === eng.talentId),
    }))
    .filter((eng) => eng.talent) as (TalentEngagement & { talent: Talent })[] : [];

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
    switchCompany(newAccount);
    toast.success(`Switched to ${newAccount.name}`);
  };
  
  const handleBackToCompanies = () => {
    navigate('/companies');
  };

  const handleCompanySaveAndSwitch = () => {
    toast.success("Changes saved");
    if (pendingCompany) performCompanySwitch(pendingCompany);
    setPendingCompany(null);
    setShowCompanySaveDialog(false);
  };

  const handleCompanyDiscardAndSwitch = () => {
    if (pendingCompany) performCompanySwitch(pendingCompany);
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
    setAccount((prev) => {
      if (!prev) return prev;
      return { ...prev, contacts: [...prev.contacts, contact] };
    });
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
    if (account && selectedAccount.id !== account.id) {
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
  }, [account?.id, hasUnsavedChanges]);

  const handleTalentClick = useCallback((talent: Talent, engagement: TalentEngagement) => {
    setSelectedTalent(talent);
    setShowTalentPanel(true);
  }, []);

  const handleCloseTalentPanel = () => {
    setSelectedTalent(null);
    setShowTalentPanel(false);
  };

  const handleNodeSelect = useCallback((contactId: string | null) => {
    setSelectedNodeId(contactId);
  }, [setSelectedNodeId]);

  // Unified drop zone handler for the 4-zone snap system
  const handleDropZone = useCallback(async (draggedContactId: string, targetContactId: string | null, zone: DropZone) => {
    try {
      switch (zone) {
        case "company_root":
          // Make dragged node the root (most senior position)
          await setParent({ childContactId: draggedContactId, parentContactId: null });
          toast.success("Set as top-level contact");
          break;
        case "bottom":
          // Drop onto card = become child of target
          if (!targetContactId) return;
          await setParent({ childContactId: draggedContactId, parentContactId: targetContactId });
          toast.success("Connected as report");
          break;
        case "left":
          // Insert as sibling before target
          if (!targetContactId) return;
          await insertAsSibling({ draggedContactId, targetContactId, side: "before" });
          toast.success("Inserted before");
          break;
        case "right":
          // Insert as sibling after target
          if (!targetContactId) return;
          await insertAsSibling({ draggedContactId, targetContactId, side: "after" });
          toast.success("Inserted after");
          break;
      }
    } catch (err: any) {
      if (err?.message === "Cycle detected") {
        toast.error("Cannot create circular reporting relationship");
      } else {
        console.error('Drop zone action failed:', err);
        toast.error("Failed to update relationship");
      }
    }
  }, [setParent, insertAsSibling, insertAsParent]);

  // Build toolbar actions
  const toolbarActions: ToolbarAction[] = useMemo(() => {
    const actions: ToolbarAction[] = [];
    actions.push({
      id: "org-chart",
      label: "Build Org Chart",
      icon: <GitBranch className="w-4 h-4" />,
      onClick: () => setShowOrgChartBuilder(true),
      priority: "secondary",
    });
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

  const toolbarLeftContent = account ? (
    <>
      <Button variant="ghost" size="sm" onClick={handleBackToCompanies} className="gap-2 shrink-0">
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Companies</span>
      </Button>
      <div className="h-6 w-px bg-border shrink-0" />
      <div className="min-w-0 shrink-0">
        <h1 className="text-lg font-bold truncate">{account.name}</h1>
        <p className="text-sm text-muted-foreground truncate">{account.industry}</p>
      </div>
      <div className="h-6 w-px bg-border shrink-0" />
      <CompanySwitcher 
        currentCompany={account.name}
        companies={allAccounts}
        onCompanySelect={handleCompanySwitch}
      />
      <QRCodeButton accountId={account.id} accountName={account.name} />
      <div className="h-6 w-px bg-border shrink-0" />
      <GlobalSearch
        onSelectCompany={handleGlobalSelectCompany}
        onSelectContact={handleGlobalSelectContact}
      />
      <div className="h-6 w-px bg-border shrink-0" />
      
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
  ) : null;

  if (isLoadingCompany) {
    return (
      <div className="flex flex-col h-[calc(100vh-65px)] items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading company...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col h-[calc(100vh-65px)] items-center justify-center gap-4">
        <Network className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Company Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Select a company from your database to view it on the canvas.
        </p>
        <Button onClick={handleBackToCompanies} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Go to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <div 
        data-toolbar-ribbon
        className="border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <ResponsiveToolbar leftContent={toolbarLeftContent} actions={toolbarActions} />
        </div>
        {viewMode === "canvas" && account && (
          <>
            <div className="h-6 w-px bg-border shrink-0" />
            <CanvasModeToggle mode={canvasMode} onModeChange={setCanvasMode} />
          </>
        )}
      </div>

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
            interactionMode={canvasMode}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onDropZone={handleDropZone}
            workspaceId={currentWorkspace?.id}
            edgeParentMap={edgeParentMap}
            edgeChildrenMap={edgeChildrenMap}
            rootContactId={rootContactId}
          />
        ) : (
          <CompanyDatabaseView
            account={account}
            allAccounts={allAccounts}
            onAccountUpdate={setAccount}
            onViewCanvas={() => setViewMode("canvas")}
            onAddContact={() => setShowAddContactModal(true)}
            onAIImport={() => setShowAIImportModal(true)}
          />
        )}
      </main>

      {/* Contact Panel */}
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
            <AlertDialogCancel onClick={handleCancelSwitch}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardAndSwitch}>Discard & Switch</Button>
            <AlertDialogAction onClick={handleSaveAndSwitch}>Save & Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCompanySaveDialog} onOpenChange={setShowCompanySaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes Before Switching Company?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. What would you like to do before switching to {pendingCompany?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCompanyCancelSwitch}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleCompanyDiscardAndSwitch}>Discard & Switch</Button>
            <AlertDialogAction onClick={handleCompanySaveAndSwitch}>Save & Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddContactModal
        open={showAddContactModal}
        onOpenChange={setShowAddContactModal}
        onAddContact={handleAddContact}
        companyName={account.name}
      />

      <SmartImportModal
        open={showAIImportModal}
        onOpenChange={setShowAIImportModal}
        context={{
          source: 'CANVAS',
          companyId: account.id,
          companyName: account.name,
        }}
      />

      <OrgChartBuilderModal
        open={showOrgChartBuilder}
        onOpenChange={setShowOrgChartBuilder}
        companyId={account.id}
        companyName={account.name}
        onImportComplete={(contactIds, _companyId) => {
          setShowOrgChartBuilder(false);
          setViewMode("canvas");
          setHighlightedContactIds(contactIds);
          setTimeout(() => canvasRef.current?.highlightContacts(contactIds), 500);
          setTimeout(() => setHighlightedContactIds([]), 10000);
          toast.success(`${contactIds.length} contacts imported and displayed on canvas`);
        }}
      />

      {viewMode === "canvas" && (
        <AIKnowledgePanel
          account={account}
          isOpen={isAIKnowledgeOpen}
          onToggle={() => setIsAIKnowledgeOpen(!isAIKnowledgeOpen)}
          onHighlightContacts={handleHighlightContacts}
        />
      )}

      {viewMode === "canvas" && (
        <AIInsightsPanel
          account={account}
          isOpen={isAIInsightsOpen}
          onToggle={() => setIsAIInsightsOpen(!isAIInsightsOpen)}
          onHighlightContacts={handleHighlightContacts}
        />
      )}

      {viewMode === "canvas" && (
        <AIRoleSuggestionsPanel
          account={account}
          isOpen={isRoleSuggestionsOpen}
          onToggle={() => setIsRoleSuggestionsOpen(!isRoleSuggestionsOpen)}
          onAddContact={handleAddContact}
        />
      )}

      <TalentProfilePanel
        talent={selectedTalent}
        open={showTalentPanel}
        onClose={handleCloseTalentPanel}
      />

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
              {isEditMode 
                ? "Drag contacts to reposition • Drop on card = child • Drop left/right = sibling • Drop on company = top contact"
                : "Click to see details • Scroll to zoom"
              }
            </p>
          </div>
        </div>
      )}

      <OnboardingModal
        open={showOnboardingModal}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />

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

