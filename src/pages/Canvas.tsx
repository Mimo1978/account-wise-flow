import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Brain, Network, Table2, Lightbulb, UserPlus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
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
import { Account, Contact } from "@/lib/types";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

const Canvas = () => {
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
  const canvasRef = useRef<AccountCanvasRef>(null);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-xl font-bold">{account.name}</h1>
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
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative pointer-events-auto">
        {viewMode === "canvas" ? (
          <AccountCanvas 
            ref={canvasRef}
            account={account} 
            onContactClick={handleContactClick}
            highlightedContactIds={highlightedContactIds}
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
    </div>
  );
};

export default Canvas;
