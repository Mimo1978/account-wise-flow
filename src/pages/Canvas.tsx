import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users, GitBranch, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AccountCanvas, AccountCanvasRef, DropZone } from "@/components/canvas/AccountCanvas";
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
import { useCompanyCanvas } from "@/hooks/use-company-canvas";
import { useCanvasMode } from "@/hooks/use-canvas-mode";
import { CanvasModeToggle } from "@/components/canvas/CanvasModeToggle";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOrgChartTree } from "@/hooks/use-org-chart-tree";

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
  // Use the company canvas hook instead of mock data
  const { 
    account: loadedAccount, 
    accounts: allAccounts, 
    isLoading: isLoadingCompany,
    switchCompany,
    isUsingMockData,
    setAccount: setLoadedAccount,
  } = useCompanyCanvas({ fallbackToMock: true });
  
  // Local account state for canvas operations
  const [account, setAccount] = useState<Account | null>(null);
  
  // Sync loaded account to local state
  useEffect(() => {
    if (loadedAccount) {
      setAccount(loadedAccount);
    }
  }, [loadedAccount]);

  // Handle highlight param from navigation (e.g. after org chart import)
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
        // Remove highlight param from URL
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
  
  // Canvas interaction mode
  const {
    mode: canvasMode,
    isEditMode,
    setMode: setCanvasMode,
    selectedNodeId,
    setSelectedNodeId,
  } = useCanvasMode();

  // Post-edit save dialog
  const [showEditSaveDialog, setShowEditSaveDialog] = useState(false);
  const [hasPendingStructuralChanges, setHasPendingStructuralChanges] = useState(false);

  // Get engagements for current company with talent data
  const companyEngagements = account ? mockEngagements
    .filter((eng) => eng.companyId === account.id)
    .map((eng) => ({
      ...eng,
      talent: mockTalents.find((t) => t.id === eng.talentId),
    }))
    .filter((eng) => eng.talent) as (TalentEngagement & { talent: Talent })[] : [];

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
    
    // Use the hook's switch function to navigate with URL
    switchCompany(newAccount);
    
    toast.success(`Switched to ${newAccount.name}`);
  };
  
  // Back to companies handler
  const handleBackToCompanies = () => {
    navigate('/companies');
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
    // In edit mode, clicks are used for carry/drag — never open the record
    if (canvasMode === "edit") return;

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
    setAccount((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contacts: [...prev.contacts, contact],
      };
    });
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
    if (account && selectedAccount.id !== account.id) {
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
  }, [account?.id, hasUnsavedChanges]);

  const handleTalentClick = useCallback((talent: Talent, engagement: TalentEngagement) => {
    setSelectedTalent(talent);
    setShowTalentPanel(true);
  }, []);

  const handleCloseTalentPanel = () => {
    setSelectedTalent(null);
    setShowTalentPanel(false);
  };

  // Handle node selection in edit mode
  const handleNodeSelect = useCallback((contactId: string | null) => {
    setSelectedNodeId(contactId);
  }, [setSelectedNodeId]);

  // Org chart tree hook for structural drops
  const { nodes: orgNodes, setParent, ensureNode } = useOrgChartTree(account?.id);

  // Handle structural drop from 3-zone system:
  //   "top"    = sibling before target (same parent)
  //   "bottom" = sibling after target (same parent)
  //   "left"   = child of target (center zone)
  //   "company_root" = new root node
  const queryClient = useQueryClient();
  const handleStructuralDrop = useCallback(async (draggedId: string, targetId: string | null, zone: DropZone) => {
    if (!account) return;
    
    try {
      switch (zone) {
        case "company_root":
          await setParent({ contactId: draggedId, newParentContactId: null, newSiblingOrder: 0 });
          break;

        case "left": {
          // Left of target → insert as sibling BEFORE target (lower sibling order)
          if (!targetId) return;
          const targetNodeLeft = orgNodes.find(n => n.contactId === targetId);
          const parentIdLeft = targetNodeLeft?.parentContactId ?? null;
          const orderLeft = Math.max(0, (targetNodeLeft?.siblingOrder ?? 0));
          // Shift target and later siblings forward to make room
          const siblingsToShiftLeft = orgNodes.filter(n => n.parentContactId === parentIdLeft && n.contactId !== draggedId && n.siblingOrder >= orderLeft);
          for (const sib of siblingsToShiftLeft) {
            await setParent({ contactId: sib.contactId, newParentContactId: parentIdLeft, newSiblingOrder: sib.siblingOrder + 1 });
          }
          await setParent({ contactId: draggedId, newParentContactId: parentIdLeft, newSiblingOrder: orderLeft });
          break;
        }

        case "right": {
          // Right of target → insert as sibling AFTER target (higher sibling order)
          if (!targetId) return;
          const targetNodeRight = orgNodes.find(n => n.contactId === targetId);
          const parentIdRight = targetNodeRight?.parentContactId ?? null;
          const orderRight = (targetNodeRight?.siblingOrder ?? 0) + 1;
          // Shift later siblings forward
          const siblingsToShiftRight = orgNodes.filter(n => n.parentContactId === parentIdRight && n.contactId !== draggedId && n.siblingOrder >= orderRight);
          for (const sib of siblingsToShiftRight) {
            await setParent({ contactId: sib.contactId, newParentContactId: parentIdRight, newSiblingOrder: sib.siblingOrder + 1 });
          }
          await setParent({ contactId: draggedId, newParentContactId: parentIdRight, newSiblingOrder: orderRight });
          break;
        }

        case "bottom": {
          // Below target → connect as NEW CHILD of target (new branch)
          if (!targetId) return;
          const existingChildren = orgNodes.filter(n => n.parentContactId === targetId);
          const nextOrder = existingChildren.length > 0 ? Math.max(...existingChildren.map(c => c.siblingOrder)) + 1 : 0;
          await setParent({ contactId: draggedId, newParentContactId: targetId, newSiblingOrder: nextOrder });
          break;
        }

        case "top": {
          // Top — treat same as left (sibling before)
          if (!targetId) return;
          const targetNodeTop = orgNodes.find(n => n.contactId === targetId);
          const parentIdTop = targetNodeTop?.parentContactId ?? null;
          const orderTop = Math.max(0, (targetNodeTop?.siblingOrder ?? 0));
          const siblingsToShiftTop = orgNodes.filter(n => n.parentContactId === parentIdTop && n.contactId !== draggedId && n.siblingOrder >= orderTop);
          for (const sib of siblingsToShiftTop) {
            await setParent({ contactId: sib.contactId, newParentContactId: parentIdTop, newSiblingOrder: sib.siblingOrder + 1 });
          }
          await setParent({ contactId: draggedId, newParentContactId: parentIdTop, newSiblingOrder: orderTop });
          break;
        }
      }
      
      // Await refetch so the canvas rebuilds immediately with new hierarchy + connectors
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['canvas-company', account.id] }),
        queryClient.refetchQueries({ queryKey: ['org-chart-tree', account.id] }),
      ]);
      
      // Mark that structural changes have been saved, prompt user to return to browse or continue
      setHasPendingStructuralChanges(true);
      setShowEditSaveDialog(true);
    } catch (err) {
      console.error("Failed to update hierarchy:", err);
      toast.error("Failed to update hierarchy");
    }
  }, [account, orgNodes, setParent, queryClient]);


  // Build toolbar actions with proper priority grouping
  const toolbarActions: ToolbarAction[] = useMemo(() => {
    const actions: ToolbarAction[] = [];

    // Secondary actions (can overflow into "More" menu)
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
  const toolbarLeftContent = account ? (
    <>
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBackToCompanies}
        className="gap-2 shrink-0"
      >
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
  ) : null;

  // Loading state
  if (isLoadingCompany) {
    return (
      <div className="flex flex-col h-[calc(100vh-65px)] items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading company...</p>
      </div>
    );
  }

  // No company state
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
      {/* Sub-header with context controls */}
      <div 
        data-toolbar-ribbon
        className="border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <ResponsiveToolbar
            leftContent={toolbarLeftContent}
            actions={toolbarActions}
          />
        </div>
        {/* Canvas Mode Toggle - always visible in canvas view */}
        {viewMode === "canvas" && account && (
          <>
            <div className="h-6 w-px bg-border shrink-0" />
            <CanvasModeToggle
              mode={canvasMode}
              onModeChange={setCanvasMode}
            />
          </>
        )}
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
            interactionMode={canvasMode}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onStructuralDrop={handleStructuralDrop}
            workspaceId={currentWorkspace?.id}
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

      {/* Edit Structure Save Dialog — shown after each structural change */}
      <AlertDialog open={showEditSaveDialog} onOpenChange={setShowEditSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Structure Saved ✓</AlertDialogTitle>
            <AlertDialogDescription>
              The org chart has been updated and saved. Would you like to return to Browse mode to view contact profiles, or continue editing the structure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowEditSaveDialog(false);
              }}
            >
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEditSaveDialog(false);
                setHasPendingStructuralChanges(false);
                setCanvasMode("browse");
              }}
            >
              Save & Return to Browse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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

      {/* Org Chart Builder Modal */}
      <OrgChartBuilderModal
        open={showOrgChartBuilder}
        onOpenChange={setShowOrgChartBuilder}
        companyId={account.id}
        companyName={account.name}
        onImportComplete={(contactIds, _companyId) => {
          setShowOrgChartBuilder(false);
          setViewMode("canvas");
          // Highlight newly imported contacts on the canvas
          setHighlightedContactIds(contactIds);
          // Trigger canvas highlight for immediate visual feedback after re-render
          setTimeout(() => {
            canvasRef.current?.highlightContacts(contactIds);
          }, 500);
          // Clear highlight after 10 seconds
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
              {isEditMode 
                ? "Drag a contact onto another to connect it • Left = sibling • Bottom = child branch • Esc to cancel"
                : "Click a contact to open their record • Switch to Edit Structure to rearrange the org chart"
              }
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
