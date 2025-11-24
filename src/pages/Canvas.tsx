import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AccountCanvas } from "@/components/canvas/AccountCanvas";
import { ContactDetailPanel } from "@/components/canvas/ContactDetailPanel";
import { mockAccount } from "@/lib/mock-data";
import { Contact } from "@/lib/types";

const Canvas = () => {
  const [account] = useState(mockAccount);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="w-4 h-4" />
                AI Suggestions
              </Button>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1">
          <AccountCanvas 
            account={account} 
            onContactClick={setSelectedContact}
          />
        </div>
        {selectedContact && (
          <ContactDetailPanel 
            contact={selectedContact} 
            onClose={() => setSelectedContact(null)}
          />
        )}
      </main>

      {/* Bottom Info Bar */}
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
    </div>
  );
};

export default Canvas;
