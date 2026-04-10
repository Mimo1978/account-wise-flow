import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FlashConfirmOverlay } from "@/components/ui/flash-confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JarvisSpotlightProvider, JarvisSpotlightOverlay } from "@/contexts/JarvisSpotlightContext";
import { ConfirmationProvider } from "@/contexts/ConfirmationContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { SearchContextProvider } from "@/contexts/SearchContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { WelcomeModal } from "@/components/auth/WelcomeModal";
import { ProductLayout } from "@/components/layout/ProductLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/components/ui/sonner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Canvas from "./pages/Canvas";
import HomeCommandCenter from "./pages/HomeCommandCenter";
import ContactsDatabase from "./pages/ContactsDatabase";
import CompaniesDatabase from "./pages/CompaniesDatabase";
import CompanyDetail from "./pages/CompanyDetail";
import ContactDetail from "./pages/ContactDetail";
import TalentDatabase from "./pages/TalentDatabase";
import ExecutiveInsights from "./pages/ExecutiveInsights";
import Demo from "./pages/Demo";
import DemoWorkspace from "./pages/DemoWorkspace";
import WorkspaceSelector from "./pages/WorkspaceSelector";
import Pricing from "./pages/Pricing";
import ImportReview from "./pages/ImportReview";
import ImportHistory from "./pages/ImportHistory";
import CandidateProfile from "./pages/CandidateProfile";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import Outreach from "./pages/Outreach";
import SchemaInventory from "./pages/SchemaInventory";
import Onboarding from "./pages/Onboarding";
import ProjectsList from "./pages/ProjectsList";
import DealsPage from "./pages/DealsPage";
import DocumentsHub from "./pages/DocumentsHub";
import JobsList from "./pages/JobsList";
import JobDetail from "./pages/JobDetail";
import PublicJobBoard from "./pages/PublicJobBoard";
import ProjectDetail from "./pages/ProjectDetail";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminAccess from "./pages/admin/AdminAccess";
import AdminOutreach from "./pages/admin/AdminOutreach";
import AdminDataQuality from "./pages/admin/AdminDataQuality";
import AdminGovernance from "./pages/admin/AdminGovernance";

import AdminBilling from "./pages/admin/AdminBilling";
import AdminJarvisGuide from "./pages/admin/AdminJarvisGuide";
import AdminJarvisSettings from "./pages/admin/AdminJarvisSettings";
import AdminEmailGuide from "./pages/admin/AdminEmailGuide";
import AdminSmsGuide from "./pages/admin/AdminSmsGuide";
import AdminAiCallingGuide from "./pages/admin/AdminAiCallingGuide";
import AdminIntegrations from "./pages/admin/AdminIntegrations";
import AccountsBillingHub from "./pages/AccountsBillingHub";
import CrmOpportunityDetail from "./pages/crm/CrmOpportunityDetail";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmDealDetail from "./pages/crm/CrmDealDetail";
import CrmInvoices from "./pages/crm/CrmInvoices";
import CrmInvoiceDetail from "./pages/crm/CrmInvoiceDetail";
import IntegrationsSettings from "./pages/settings/IntegrationsSettings";
import EmailTemplatesSettings from "./pages/settings/EmailTemplatesSettings";
import Dashboard from "./pages/Dashboard";
import PlacementDetail from "./pages/PlacementDetail";
import PlacementsList from "./pages/PlacementsList";
import { Loader2 } from "lucide-react";
import { JarvisFloatingButton } from "@/components/jarvis/JarvisChat";

const queryClient = new QueryClient();

/** Gate that redirects non-admin/manager away from /admin with a toast */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { role, isLoading, isAdmin, isManager } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin && !isManager) {
      toast.error("Admin access required");
      navigate("/", { replace: true });
    }
  }, [isLoading, isAdmin, isManager, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !isManager) return null;

  return <>{children}</>;
}

/** Shared wrapper for all admin routes */
function AdminPage({ section, children }: { section: React.ComponentProps<typeof AdminRouteGuard>['section']; children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGate>
        <ProductLayout>
          <AdminLayout>
            <AdminRouteGuard section={section}>{children}</AdminRouteGuard>
          </AdminLayout>
        </ProductLayout>
      </AdminGate>
    </ProtectedRoute>
  );
}

const App = () => {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection caught:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <AuthProvider>
      <WorkspaceProvider>
      <SearchContextProvider>
      <TooltipProvider>
        <ConfirmationProvider>
        <Toaster />
        <Sonner />
        <FlashConfirmOverlay />
        <BrowserRouter>
          <JarvisSpotlightProvider>
          <JarvisSpotlightOverlay />
          <WelcomeModal />
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/signup" element={<Navigate to="/auth" replace />} />
            <Route path="/auth/sign-in" element={<Navigate to="/auth?tab=signin" replace />} />
            <Route path="/auth/sign-up" element={<Navigate to="/auth?tab=signup" replace />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/jobs/board" element={<PublicJobBoard />} />

            {/* PROTECTED ROUTES */}
            <Route path="/home" element={<ProtectedRoute><ProductLayout><HomeCommandCenter /></ProductLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><ProductLayout><Dashboard /></ProductLayout></ProtectedRoute>} />
            
            <Route path="/workspace" element={<ProtectedRoute><WorkspaceSelector /></ProtectedRoute>} />
            <Route path="/demo-workspace" element={<ProtectedRoute><ProductLayout><DemoWorkspace /></ProductLayout></ProtectedRoute>} />
            <Route path="/canvas" element={<ProtectedRoute><ProductLayout><Canvas /></ProductLayout></ProtectedRoute>} />
            <Route path="/database" element={<Navigate to="/companies" replace />} />
            <Route path="/companies" element={<ProtectedRoute><ProductLayout><CompaniesDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute><ProductLayout><DealsPage /></ProductLayout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><ProductLayout><DocumentsHub /></ProductLayout></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><ProductLayout><AccountsBillingHub /></ProductLayout></ProtectedRoute>} />
            <Route path="/companies/:id" element={<ProtectedRoute><ProductLayout><CompanyDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><ProductLayout><ContactsDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute><ProductLayout><ContactDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/talent" element={<ProtectedRoute><ProductLayout><TalentDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/talent/:candidateId" element={<ProtectedRoute><ProductLayout><CandidateProfile /></ProductLayout></ProtectedRoute>} />
            <Route path="/outreach" element={<ProtectedRoute><ProductLayout><Outreach /></ProductLayout></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><ProductLayout><ExecutiveInsights /></ProductLayout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProductLayout><ProjectsList /></ProductLayout></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProductLayout><ProjectDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><ProductLayout><JobsList /></ProductLayout></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><ProductLayout><JobDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/imports" element={<ProtectedRoute><ProductLayout><ImportHistory /></ProductLayout></ProtectedRoute>} />
            <Route path="/imports/:batchId/review" element={<ProtectedRoute><ProductLayout><ImportReview /></ProductLayout></ProtectedRoute>} />
            <Route path="/workspace-settings" element={<ProtectedRoute><ProductLayout><WorkspaceSettings /></ProductLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProductLayout><UserProfile /></ProductLayout></ProtectedRoute>} />

            {/* CRM MODULE ROUTES */}
            <Route path="/crm/opportunities/:id" element={<ProtectedRoute><ProductLayout><CrmOpportunityDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/deals" element={<ProtectedRoute><ProductLayout><CrmDeals /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/deals/:id" element={<ProtectedRoute><ProductLayout><CrmDealDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/placements" element={<ProtectedRoute><ProductLayout><PlacementsList /></ProductLayout></ProtectedRoute>} />
            <Route path="/placements/:id" element={<ProtectedRoute><ProductLayout><PlacementDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/projects" element={<Navigate to="/projects" replace />} />
            <Route path="/crm/projects/:id" element={<Navigate to="/projects" replace />} />
            <Route path="/crm/invoices" element={<Navigate to="/accounts" replace />} />
            <Route path="/crm/invoices/:id" element={<Navigate to="/accounts" replace />} />

            {/* SETTINGS ROUTES */}
            <Route path="/settings/integrations" element={<ProtectedRoute><ProductLayout><IntegrationsSettings /></ProductLayout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute><ProductLayout><EmailTemplatesSettings /></ProductLayout></ProtectedRoute>} />

            {/* ADMIN CONSOLE ROUTES */}
            <Route path="/admin" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/overview" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/access" element={<AdminPage section="access"><AdminAccess /></AdminPage>} />
            <Route path="/admin/roles" element={<AdminPage section="access"><AdminAccess /></AdminPage>} />
            <Route path="/admin/data-quality" element={<AdminPage section="data-quality"><AdminDataQuality /></AdminPage>} />
            <Route path="/admin/governance" element={<AdminPage section="governance"><AdminGovernance /></AdminPage>} />
            <Route path="/admin/outreach" element={<AdminPage section="outreach"><AdminOutreach /></AdminPage>} />
            <Route path="/admin/schema" element={<AdminPage section="schema"><SchemaInventory /></AdminPage>} />
            
            <Route path="/admin/billing" element={<AdminPage section="integrations"><AdminBilling /></AdminPage>} />
            <Route path="/admin/jarvis-guide" element={<AdminPage section="integrations"><AdminJarvisGuide /></AdminPage>} />
            <Route path="/admin/jarvis-settings" element={<AdminPage section="integrations"><AdminJarvisSettings /></AdminPage>} />
            <Route path="/admin/email-guide" element={<AdminPage section="integrations"><AdminEmailGuide /></AdminPage>} />
            <Route path="/admin/sms-guide" element={<AdminPage section="integrations"><AdminSmsGuide /></AdminPage>} />
            <Route path="/admin/ai-calling-guide" element={<AdminPage section="integrations"><AdminAiCallingGuide /></AdminPage>} />
            <Route path="/admin/integrations" element={<AdminPage section="integrations"><AdminIntegrations /></AdminPage>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <JarvisFloatingButton />
          </JarvisSpotlightProvider>
        </BrowserRouter>
      </ConfirmationProvider>
      </TooltipProvider>
      </SearchContextProvider>
      </WorkspaceProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
