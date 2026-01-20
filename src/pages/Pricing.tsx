import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles, Users, Zap, Brain, Building2, UserCheck, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const tiers = [
  {
    name: "Core",
    tagline: "Client Mapper Core",
    description: "For account managers, founders, and sales teams",
    price: "From £29",
    priceNote: "per user / month",
    icon: Users,
    features: [
      "Visual relationship mapping (org charts & canvas)",
      "Contact + company databases",
      "Notes, meeting capture, AI summaries",
      "Gap identification (missing roles, weak coverage)",
      "Public demo access (read-only)",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    tagline: "Client Mapper Growth",
    description: "For consultancies, recruiters, delivery teams",
    price: "From £49",
    priceNote: "per user / month",
    icon: UserCheck,
    features: [
      "Everything in Core",
      "Talent / CV database",
      "Contractor tracking & renewals",
      "Availability & deployment visibility",
      "Hiring pipeline insights",
      "Candidate relationship mapping",
    ],
    highlighted: true,
  },
  {
    name: "Intelligence",
    tagline: "Client Mapper Intelligence",
    description: "For revenue leaders & scaleups",
    price: "Contact Sales",
    priceNote: "custom pricing",
    icon: Brain,
    features: [
      "Everything in Growth",
      "AI opportunity detection across notes & orgs",
      "Sales thread identification",
      "Executive insight layer",
      "Renewal risk & expansion signals",
      "AI meeting prep, follow-ups, reminders",
      "Calendar & email linkage",
    ],
    highlighted: false,
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Marketing Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link to="/#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link to="/#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Security
              </Link>
              <Link to="/pricing" className="text-sm font-medium text-foreground">
                Pricing
              </Link>
              {user ? (
                <Link to="/canvas">
                  <Button variant="default" className="gap-2">
                    Go to App <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/demo">
                    <Button variant="ghost" className="gap-2">
                      Try Public Demo
                    </Button>
                  </Link>
                  <Link to="/auth?next=/demo-workspace">
                    <Button variant="default" className="gap-2">
                      Sign in for Full Demo <ArrowRight className="w-4 h-4" />
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
                  <Link 
                    to="/#features" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Features
                  </Link>
                  <Link 
                    to="/#how-it-works" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    How It Works
                  </Link>
                  <Link 
                    to="/#security" 
                    className="text-lg font-medium text-foreground py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Security
                  </Link>
                  <Link 
                    to="/pricing" 
                    className="text-lg font-medium text-primary py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <div className="border-t border-border my-4" />
                  {user ? (
                    <Link to="/canvas" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full gap-2">
                        Go to App <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Link to="/demo" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full gap-2">
                          Try Public Demo
                        </Button>
                      </Link>
                      <Link to="/auth?next=/demo-workspace" onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full gap-2">
                          Sign in for Full Demo <ArrowRight className="w-4 h-4" />
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

      {/* Hero */}
      <section className="container mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Choose the plan that fits your team
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Start with relationship visibility. Scale to revenue intelligence.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                tier.highlighted
                  ? "bg-primary text-primary-foreground border-2 border-primary shadow-lg scale-105"
                  : "bg-card border border-border"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-sm font-medium rounded-full">
                  Most Popular
                </div>
              )}
              
              <div className="mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  tier.highlighted ? "bg-primary-foreground/20" : "bg-primary/10"
                }`}>
                  <tier.icon className={`w-6 h-6 ${tier.highlighted ? "text-primary-foreground" : "text-primary"}`} />
                </div>
                <h3 className="text-2xl font-bold mb-1">{tier.tagline}</h3>
                <p className={`text-sm ${tier.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {tier.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="text-3xl font-bold">{tier.price}</div>
                <div className={`text-sm ${tier.highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {tier.priceNote}
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 shrink-0 mt-0.5 ${
                      tier.highlighted ? "text-primary-foreground" : "text-primary"
                    }`} />
                    <span className={`text-sm ${tier.highlighted ? "text-primary-foreground/90" : "text-foreground"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                {tier.name === "Intelligence" ? (
                  <Button 
                    variant={tier.highlighted ? "secondary" : "default"} 
                    className="w-full gap-2"
                    size="lg"
                  >
                    Contact Sales <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Link to="/auth?next=/demo-workspace">
                    <Button 
                      variant={tier.highlighted ? "secondary" : "default"} 
                      className="w-full gap-2"
                      size="lg"
                    >
                      Start Free Trial <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <Link to="/demo">
                  <Button 
                    variant="ghost" 
                    className={`w-full ${tier.highlighted ? "text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10" : ""}`}
                  >
                    Try Public Demo
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="container mx-auto px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Compare Features</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Core</th>
                  <th className="text-center py-4 px-4 font-semibold text-primary">Growth</th>
                  <th className="text-center py-4 px-4 font-semibold">Intelligence</th>
                </tr>
              </thead>
              <tbody>
                <FeatureRow feature="Visual org chart canvas" core={true} growth={true} intelligence={true} />
                <FeatureRow feature="Contact & company database" core={true} growth={true} intelligence={true} />
                <FeatureRow feature="Notes & meeting capture" core={true} growth={true} intelligence={true} />
                <FeatureRow feature="AI summaries" core={true} growth={true} intelligence={true} />
                <FeatureRow feature="Gap identification" core={true} growth={true} intelligence={true} />
                <FeatureRow feature="Talent / CV database" core={false} growth={true} intelligence={true} />
                <FeatureRow feature="Contractor tracking" core={false} growth={true} intelligence={true} />
                <FeatureRow feature="Availability visibility" core={false} growth={true} intelligence={true} />
                <FeatureRow feature="AI opportunity detection" core={false} growth={false} intelligence={true} />
                <FeatureRow feature="Executive insight layer" core={false} growth={false} intelligence={true} />
                <FeatureRow feature="Renewal risk signals" core={false} growth={false} intelligence={true} />
                <FeatureRow feature="Calendar & email linkage" core={false} growth={false} intelligence={true} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to see your relationships clearly?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Try the public demo instantly, or sign in to explore the full demo workspace with all features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 gap-2">
                Try Public Demo
              </Button>
            </Link>
            <Link to="/auth?next=/demo-workspace">
              <Button size="lg" className="gap-2 text-lg px-8">
                Sign in for Full Demo <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">CLIENT MAPPER</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              © 2025 CLIENT MAPPER. Relationship intelligence for modern teams.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureRow = ({ 
  feature, 
  core, 
  growth, 
  intelligence 
}: { 
  feature: string; 
  core: boolean; 
  growth: boolean; 
  intelligence: boolean; 
}) => (
  <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
    <td className="py-4 px-4 text-sm">{feature}</td>
    <td className="py-4 px-4 text-center">
      {core ? <Check className="w-5 h-5 text-primary mx-auto" /> : <span className="text-muted-foreground">—</span>}
    </td>
    <td className="py-4 px-4 text-center bg-primary/5">
      {growth ? <Check className="w-5 h-5 text-primary mx-auto" /> : <span className="text-muted-foreground">—</span>}
    </td>
    <td className="py-4 px-4 text-center">
      {intelligence ? <Check className="w-5 h-5 text-primary mx-auto" /> : <span className="text-muted-foreground">—</span>}
    </td>
  </tr>
);

export default Pricing;
