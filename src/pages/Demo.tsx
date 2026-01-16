import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload, Users, LogIn } from "lucide-react";
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
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import { mockTalents, mockEngagements } from "@/lib/mock-talent";
import { Account, Contact, Talent, TalentEngagement } from "@/lib/types";
import { TalentProfilePanel } from "@/components/talent/TalentProfilePanel";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
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
import { Sparkles } from "lucide-react";

const Demo = () => {
  const [account, setAccount] = useState(mockAccount);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingContact, setPendingContact] = useState<Contact | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [viewMode, setViewMode] = useState<"canvas" | "database">("canvas");
  const [isAIKnowledgeOpen, setIsAIKnowledgeOpen] = useState(false);
  const [isAIInsightsOpen, setIsAIInsightsOpen] = useState(false);
  const [isRoleSuggestionsOpen, setIsRoleSuggestionsOpen] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [showTalentPanel, setShowTalentPanel] = useState(false);
  const [showTalentOverlay, setShowTalentOverlay] = useState(false);
  const [highlightedContactIds, setHighlightedContactIds] = useState<string[]>([]);
  const canvasRef = useRef<AccountCanvasRef>(null);

  // Get engagements for current company
  const companyEngagements = mockEngagements.filter(e => e.companyId === account.id);

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
    toast.success(`Contact "${contact.name}" added successfully`);
  };

  const handleCompanySwitch = (newAccount: Account) => {
    setAccount(newAccount);
    setSelectedContact(null);
    setIsExpanded(false);
  };

  const handleHighlightContacts = useCallback((contactIds: string[]) => {
    setHighlightedContactIds(contactIds);
    canvasRef.current?.highlightContacts(contactIds);
  }, []);

  const handleGlobalSelectCompany = useCallback((selectedAccount: Account) => {
    handleCompanySwitch(selectedAccount);
  }, []);

  const handleGlobalSelectContact = useCallback((contact: Contact, selectedAccount: Account) => {
    if (selectedAccount.id !== account.id) {
      handleCompanySwitch(selectedAccount);
    }
    setSelectedContact(contact);
    setViewMode("canvas");
    setIsExpanded(false);
    canvasRef.current?.highlightContacts([contact.id]);
    setHighlightedContactIds([contact.id]);
  }, [account.id]);

  const handleTalentClick = useCallback((talent: Talent, engagement: TalentEngagement) => {
    setSelectedTalent(talent);
    setShowTalentPanel(true);
  }, []);

  const handleCloseTalentPanel = () => {
    setSelectedTalent(null);
    setShowTalentPanel(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
            </Link>

            {/* Demo Badge & Actions */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                Public Demo
              </Badge>
              <Link to="/auth?next=/demo-workspace">
                <Button variant="default" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign in for Full Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Full Demo Callout Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border/50">
        <div className="container mx-auto px-6 py-2.5 flex items-center justify-center gap-3 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">
            Want to try imports, edits, and AI?
          </span>
          <Link 
            to="/auth?next=/demo-workspace" 
            className="font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Sign in to the Full Demo Workspace
            <LogIn className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

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
              <span className="hidden md:inline">Missing Roles</span>
            </Button>
            <Button 
              variant={isAIInsightsOpen ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setIsAIInsightsOpen(!isAIInsightsOpen)}
            >
              <Lightbulb className="w-4 h-4" />
              <span className="hidden md:inline">AI Insights</span>
            </Button>
            <Button 
              variant={isAIKnowledgeOpen ? "default" : "outline"} 
              size="sm" 
              className="gap-2"
              onClick={() => setIsAIKnowledgeOpen(!isAIKnowledgeOpen)}
            >
              <Brain className="w-4 h-4" />
              <span className="hidden md:inline">AI Knowledge</span>
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
              <span className="hidden md:inline">Add Contact</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative pointer-events-auto" style={{ height: 'calc(100vh - 170px)' }}>
        {viewMode === "canvas" ? (
          <AccountCanvas 
            ref={canvasRef}
            account={account} 
            onContactClick={handleContactClick}
            onTalentClick={handleTalentClick}
            highlightedContactIds={highlightedContactIds}
            showTalentOverlay={showTalentOverlay}
            talentEngagements={companyEngagements.map(e => ({
              ...e,
              talent: mockTalents.find(t => t.id === e.talentId)!
            })).filter(e => e.talent)}
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
        />
      )}

      {/* Talent Profile Panel */}
      {showTalentPanel && selectedTalent && (
        <TalentProfilePanel
          talent={selectedTalent}
          open={showTalentPanel}
          onClose={handleCloseTalentPanel}
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
    </div>
  );
};

export default Demo;
