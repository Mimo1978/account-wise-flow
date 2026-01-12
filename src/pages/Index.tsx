import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Zap, Shield, LogIn, Menu, X, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Marketing Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Security
              </a>
              {user ? (
                <Link to="/canvas">
                  <Button variant="default" className="gap-2">
                    Go to App <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="ghost" className="gap-2">
                      <LogIn className="w-4 h-4" />
                      Login
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      Sign Up
                    </Button>
                  </Link>
                  <Link to="/auth" state={{ demo: true }}>
                    <Button variant="default" className="gap-2">
                      Try Demo <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                <nav className="flex flex-col gap-4 mt-8">
                  <a 
                    href="#features" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a 
                    href="#how-it-works" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    How It Works
                  </a>
                  <a 
                    href="#security" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Security
                  </a>
                  <div className="border-t border-border my-4" />
                  {user ? (
                    <Link to="/canvas" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full gap-2">
                        Go to App <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full gap-2">
                          <LogIn className="w-4 h-4" />
                          Login
                        </Button>
                      </Link>
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="secondary" className="w-full gap-2">
                          <UserPlus className="w-4 h-4" />
                          Sign Up
                        </Button>
                      </Link>
                      <Link to="/auth" state={{ demo: true }} onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full gap-2">
                          Try Demo <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          The CRM that builds itself
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Stop Managing Data.
          <br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Start Building Relationships.
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          CLIENT MAPPER uses AI to automatically capture contacts, visualize org charts, 
          and generate insights—so you can focus on what matters: your relationships.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={user ? "/canvas" : "/auth"}>
            <Button size="lg" className="gap-2 text-lg px-8">
              {user ? "Go to App" : "Get Started"} <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-lg px-8">
            Watch Demo
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Zero Manual Work</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered features that work invisibly in the background
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Instant Data Capture"
            description="Scan business cards, photos, voice notes, and LinkedIn screenshots. AI extracts everything automatically."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Visual Org Charts"
            description="See relationships at a glance. Drag-and-drop canvas shows who reports to whom, buying roles, and influence."
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title="Smart Suggestions"
            description="AI tells you who to contact next, detects champions and blockers, and warns about risks."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Meeting Prep in Seconds"
            description="Get instant briefings: recent news, org changes, talking points, and strategic questions."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Relationship Intelligence"
            description="Engagement scores, sentiment analysis, and risk flags keep you ahead of account changes."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Always Up-to-Date"
            description="Monitors company news, executive moves, and org changes automatically."
          />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/30 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">It Just Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to transform your account planning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <StepCard
              number="01"
              title="Capture"
              description="Take a photo of a business card, snap a LinkedIn profile, or record voice notes. CLIENT MAPPER instantly structures everything."
            />
            <StepCard
              number="02"
              title="Visualize"
              description="Watch your org chart build itself. See departments, reporting lines, buying roles, and relationships in a clean, interactive canvas."
            />
            <StepCard
              number="03"
              title="Act"
              description="Get AI-powered suggestions on who to contact next, pre-meeting briefs, and early warnings on account risks."
            />
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Enterprise-Grade Security</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your data is protected with industry-leading security measures
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Role-Based Access</h3>
            <p className="text-muted-foreground text-sm">Fine-grained permissions ensure users only see what they should</p>
          </div>
          <div className="text-center p-6">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Data Isolation</h3>
            <p className="text-muted-foreground text-sm">Demo data is completely isolated from production environments</p>
          </div>
          <div className="text-center p-6">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Audit Logging</h3>
            <p className="text-muted-foreground text-sm">Every action is logged for compliance and accountability</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to see the future of CRM?
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            Experience the visual, AI-powered account planning platform that builds itself.
          </p>
          <Link to={user ? "/canvas" : "/auth"}>
            <Button size="lg" className="gap-2 text-lg px-10">
              {user ? "Go to App" : "Start Free Trial"} <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">CLIENT MAPPER</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 CLIENT MAPPER. The CRM that builds itself.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-base hover:shadow-lg group">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-base">
      {icon}
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary text-white text-2xl font-bold mb-6">
      {number}
    </div>
    <h3 className="text-2xl font-semibold mb-3">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default Index;
