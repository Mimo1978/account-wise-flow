import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users, GitBranch, ArrowLeft, Loader2, Link2, Unlink, Lock, Eye } from "lucide-react";
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
import { StructureToolbar } from "@/components/canvas/StructureToolbar";
import { useWorkspace } from "@/contexts/WorkspaceContext";

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
  const [structureToolbarPos, setStructureToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [linkModeSourceId, setLinkModeSourceId] = useState<string | null>(null);
  
  // Canvas interaction mode
  const {
    mode: canvasMode,
    isEditMode,
    setMode: setCanvasMode,
    selectedNodeId,
    setSelectedNodeId,
    lockedNodeIds,
    toggleLockNode,
  } = useCanvasMode();

  // Keyboard shortcuts for mode switching and cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setCanvasMode('edit');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setCanvasMode('browse');
      } else if (e.key === 'Escape') {
        if (linkModeSourceId) {
          setLinkModeSourceId(null);
        } else if (selectedNodeId) {
          setSelectedNodeId(null);
          setStructureToolbarPos(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCanvasMode, linkModeSourceId, selectedNodeId, setSelectedNodeId]);

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
    if (contactId && canvasRef.current) {
      const pos = canvasRef.current.getNodeScreenPosition(contactId);
      setStructureToolbarPos(pos);
    } else {
      setStructureToolbarPos(null);
    }
  }, [setSelectedNodeId]);

  // Handle snap-to-parent edge creation — sets manager_id on the child contact
  const handleSnapEdgeCreate = useCallback(async (childContactId: string, parentContactId: string) => {
    if (!currentWorkspace) return;
    try {
      // Clear any existing parent first (one manager rule)
      await supabase
        .from('contacts')
        .update({ manager_id: parentContactId } as any)
        .eq('id', childContactId);
      
      // Update local state so canvas re-renders with correct hierarchy
      setAccount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          contacts: prev.contacts.map(c =>
            c.id === childContactId ? { ...c, managerId: parentContactId } : c
          ),
        };
      });
      
      toast.success("Reporting relationship created");
    } catch (err) {
      console.error('Failed to set manager:', err);
      toast.error("Failed to create relationship");
    }
  }, [currentWorkspace]);

  // Unlink a contact from its manager
  const handleUnlinkFromManager = useCallback(async (contactId: string) => {
    try {
      await supabase
        .from('contacts')
        .update({ manager_id: null } as any)
        .eq('id', contactId);
      
      setAccount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          contacts: prev.contacts.map(c =>
            c.id === contactId ? { ...c, managerId: null } : c
          ),
        };
      });
      
      toast.success("Manager relationship removed");
    } catch (err) {
      console.error('Failed to unlink manager:', err);
      toast.error("Failed to remove relationship");
    }
  }, []);

  // Set a contact as CEO (connects to company root)
  const handleSetCeo = useCallback(async (contactId: string) => {
    if (!account) return;
    try {
      // Get old CEO id to unlink
      const oldCeoId = account.ceoContactId;

      // Update company's ceo_contact_id
      await supabase
        .from('companies')
        .update({ ceo_contact_id: contactId } as any)
        .eq('id', account.id);

      // Unlink new CEO from any manager (CEO reports to root)
      await supabase
        .from('contacts')
        .update({ manager_id: null } as any)
        .eq('id', contactId);

      // If there was a previous CEO, unlink them from root (nullify their special status)
      // Previous CEO becomes free-floating; user can reattach manually

      setAccount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ceoContactId: contactId,
          contacts: prev.contacts.map(c =>
            c.id === contactId ? { ...c, managerId: null } : c
          ),
        };
      });

      const contactName = account.contacts.find(c => c.id === contactId)?.name || "Contact";
      toast.success(`${contactName} set as CEO`);
    } catch (err) {
      console.error('Failed to set CEO:', err);
      toast.error("Failed to set CEO");
    }
  }, [account]);

  // Get selected contact for structure toolbar actions
  const selectedNodeContact = useMemo(() => {
    if (!selectedNodeId || !account) return null;
    return account.contacts.find(c => c.id === selectedNodeId) || null;
  }, [selectedNodeId, account]);

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
            lockedNodeIds={lockedNodeIds}
            onSnapEdgeCreate={handleSnapEdgeCreate}
            onUnlinkFromManager={handleUnlinkFromManager}
            onSetCeo={handleSetCeo}
            workspaceId={currentWorkspace?.id}
            linkModeSourceId={linkModeSourceId}
            onLinkModeSelect={(targetId) => {
              if (linkModeSourceId) {
                handleSnapEdgeCreate(linkModeSourceId, targetId);
                setLinkModeSourceId(null);
              }
            }}
            onLinkModeCancel={() => setLinkModeSourceId(null)}
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

      {/* Structure Toolbar - floating controls in edit mode */}
      {viewMode === "canvas" && isEditMode && selectedNodeId && structureToolbarPos && !linkModeSourceId && (
        <StructureToolbar
          position={structureToolbarPos}
          isLocked={lockedNodeIds.has(selectedNodeId)}
          onLink={() => {
            setLinkModeSourceId(selectedNodeId);
          }}
          onUnlink={() => { if (selectedNodeId) handleUnlinkFromManager(selectedNodeId); }}
          onToggleLock={() => toggleLockNode(selectedNodeId)}
          onViewProfile={() => {
            const contact = account.contacts.find(c => c.id === selectedNodeId);
            if (contact) {
              handleContactClick(contact);
            }
          }}
        />
      )}

      {/* Link Mode helper overlay */}
      {linkModeSourceId && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-background/95 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 pointer-events-auto">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Select a manager…</span>
            <span className="text-xs text-muted-foreground">(Esc to cancel)</span>
          </div>
        </div>
      )}

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
                ? "Click to select • Drag to reposition • Link/Unlink via toolbar"
                : "Click to select • Double-click to view profile • Drag background to pan"
              }
              <span className="ml-3 text-xs opacity-60">Press E / B to switch mode</span>
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
