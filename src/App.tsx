import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { SearchContextProvider } from "@/contexts/SearchContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import TalentDatabase from "./pages/TalentDatabase";
import ExecutiveInsights from "./pages/ExecutiveInsights";
import Demo from "./pages/Demo";
import DemoWorkspace from "./pages/DemoWorkspace";
import WorkspaceSelector from "./pages/WorkspaceSelector";
import Pricing from "./pages/Pricing";
import ImportReview from "./pages/ImportReview";
import CandidateProfile from "./pages/CandidateProfile";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import Outreach from "./pages/Outreach";
import SchemaInventory from "./pages/SchemaInventory";
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetail";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminAccess from "./pages/admin/AdminAccess";
import AdminOutreach from "./pages/admin/AdminOutreach";
import AdminDataQuality from "./pages/admin/AdminDataQuality";
import AdminIntegrations from "./pages/admin/AdminIntegrations";
import AdminBilling from "./pages/admin/AdminBilling";
import CrmCompanies from "./pages/crm/CrmCompanies";
import CrmCompanyDetail from "./pages/crm/CrmCompanyDetail";
import CrmContacts from "./pages/crm/CrmContacts";
import CrmContactDetail from "./pages/crm/CrmContactDetail";
import CrmProjects from "./pages/crm/CrmProjects";
import CrmProjectDetail from "./pages/crm/CrmProjectDetail";
import CrmPipeline from "./pages/crm/CrmPipeline";
import CrmOpportunityDetail from "./pages/crm/CrmOpportunityDetail";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmDealDetail from "./pages/crm/CrmDealDetail";
import CrmDocuments from "./pages/crm/CrmDocuments";
import CrmInvoices from "./pages/crm/CrmInvoices";
import CrmInvoiceDetail from "./pages/crm/CrmInvoiceDetail";
import IntegrationsSettings from "./pages/settings/IntegrationsSettings";
import EmailTemplatesSettings from "./pages/settings/EmailTemplatesSettings";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import { Loader2 } from "lucide-react";

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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <AuthProvider>
      <WorkspaceProvider>
      <SearchContextProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/demo" element={<Demo />} />

            {/* PROTECTED ROUTES */}
            <Route path="/home" element={<ProtectedRoute><ProductLayout><HomeCommandCenter /></ProductLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><ProductLayout><Dashboard /></ProductLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ProductLayout><Reports /></ProductLayout></ProtectedRoute>} />
            <Route path="/workspace" element={<ProtectedRoute><WorkspaceSelector /></ProtectedRoute>} />
            <Route path="/demo-workspace" element={<ProtectedRoute><ProductLayout><DemoWorkspace /></ProductLayout></ProtectedRoute>} />
            <Route path="/canvas" element={<ProtectedRoute><ProductLayout><Canvas /></ProductLayout></ProtectedRoute>} />
            <Route path="/database" element={<Navigate to="/companies" replace />} />
            <Route path="/companies" element={<ProtectedRoute><ProductLayout><CompaniesDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><ProductLayout><ContactsDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/talent" element={<ProtectedRoute><ProductLayout><TalentDatabase /></ProductLayout></ProtectedRoute>} />
            <Route path="/talent/:candidateId" element={<ProtectedRoute><ProductLayout><CandidateProfile /></ProductLayout></ProtectedRoute>} />
            <Route path="/outreach" element={<ProtectedRoute><ProductLayout><Outreach /></ProductLayout></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><ProductLayout><ExecutiveInsights /></ProductLayout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProductLayout><ProjectsList /></ProductLayout></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProductLayout><ProjectDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/imports/:batchId/review" element={<ProtectedRoute><ProductLayout><ImportReview /></ProductLayout></ProtectedRoute>} />
            <Route path="/workspace-settings" element={<ProtectedRoute><ProductLayout><WorkspaceSettings /></ProductLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProductLayout><UserProfile /></ProductLayout></ProtectedRoute>} />

            {/* CRM MODULE ROUTES */}
            <Route path="/crm/companies" element={<ProtectedRoute><ProductLayout><CrmCompanies /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/companies/:id" element={<ProtectedRoute><ProductLayout><CrmCompanyDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/contacts" element={<ProtectedRoute><ProductLayout><CrmContacts /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/contacts/:id" element={<ProtectedRoute><ProductLayout><CrmContactDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/projects" element={<ProtectedRoute><ProductLayout><CrmProjects /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/projects/:id" element={<ProtectedRoute><ProductLayout><CrmProjectDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/pipeline" element={<ProtectedRoute><ProductLayout><CrmPipeline /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/opportunities/:id" element={<ProtectedRoute><ProductLayout><CrmOpportunityDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/deals" element={<ProtectedRoute><ProductLayout><CrmDeals /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/deals/:id" element={<ProtectedRoute><ProductLayout><CrmDealDetail /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/documents" element={<ProtectedRoute><ProductLayout><CrmDocuments /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/invoices" element={<ProtectedRoute><ProductLayout><CrmInvoices /></ProductLayout></ProtectedRoute>} />
            <Route path="/crm/invoices/:id" element={<ProtectedRoute><ProductLayout><CrmInvoiceDetail /></ProductLayout></ProtectedRoute>} />

            {/* SETTINGS ROUTES */}
            <Route path="/settings/integrations" element={<ProtectedRoute><ProductLayout><IntegrationsSettings /></ProductLayout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute><ProductLayout><EmailTemplatesSettings /></ProductLayout></ProtectedRoute>} />

            {/* ADMIN CONSOLE ROUTES */}
            <Route path="/admin" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/overview" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/access" element={<AdminPage section="access"><AdminAccess /></AdminPage>} />
            <Route path="/admin/roles" element={<AdminPage section="access"><AdminAccess /></AdminPage>} />
            <Route path="/admin/data-quality" element={<AdminPage section="data-quality"><AdminDataQuality /></AdminPage>} />
            <Route path="/admin/outreach" element={<AdminPage section="outreach"><AdminOutreach /></AdminPage>} />
            <Route path="/admin/schema" element={<AdminPage section="schema"><SchemaInventory /></AdminPage>} />
            <Route path="/admin/integrations" element={<AdminPage section="integrations"><AdminIntegrations /></AdminPage>} />
            <Route path="/admin/billing" element={<AdminPage section="integrations"><AdminBilling /></AdminPage>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </SearchContextProvider>
      </WorkspaceProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
