import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { SearchContextProvider } from "@/contexts/SearchContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProductLayout } from "@/components/layout/ProductLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Canvas from "./pages/Canvas";
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
import NotFound from "./pages/NotFound";
import Outreach from "./pages/Outreach";
import SchemaInventory from "./pages/SchemaInventory";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminAccess from "./pages/admin/AdminAccess";
import AdminGovernanceRequests from "./pages/admin/AdminGovernanceRequests";
import AdminGovernanceAudit from "./pages/admin/AdminGovernanceAudit";
import AdminSignals from "./pages/admin/AdminSignals";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";

const queryClient = new QueryClient();

/** Shared wrapper for all admin routes */
function AdminPage({ section, children }: { section: React.ComponentProps<typeof AdminRouteGuard>['section']; children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <ProductLayout>
        <AdminLayout>
          <AdminRouteGuard section={section}>{children}</AdminRouteGuard>
        </AdminLayout>
      </ProductLayout>
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
            <Route path="/imports/:batchId/review" element={<ProtectedRoute><ProductLayout><ImportReview /></ProductLayout></ProtectedRoute>} />
            <Route path="/workspace-settings" element={<ProtectedRoute><ProductLayout><WorkspaceSettings /></ProductLayout></ProtectedRoute>} />

            {/* ADMIN CONSOLE ROUTES */}
            <Route path="/admin" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/overview" element={<AdminPage section="overview"><AdminOverview /></AdminPage>} />
            <Route path="/admin/access" element={<AdminPage section="access"><AdminAccess /></AdminPage>} />
            <Route path="/admin/governance/requests" element={<AdminPage section="governance"><AdminGovernanceRequests /></AdminPage>} />
            <Route path="/admin/governance/audit" element={<AdminPage section="governance"><AdminGovernanceAudit /></AdminPage>} />
            <Route path="/admin/signals" element={<AdminPage section="signals"><AdminSignals /></AdminPage>} />
            <Route path="/admin/schema" element={<AdminPage section="schema"><SchemaInventory /></AdminPage>} />
            <Route path="/admin/data-quality" element={<AdminPage section="data-quality"><AdminPlaceholder title="Data Quality" description="Data quality checks and deduplication tools." /></AdminPage>} />
            <Route path="/admin/org-chart" element={<AdminPage section="orgchart"><AdminPlaceholder title="Org Chart" description="Organization chart management." /></AdminPage>} />
            <Route path="/admin/outreach/settings" element={<AdminPage section="outreach"><AdminPlaceholder title="Outreach Settings" description="Campaign and outreach configuration." /></AdminPage>} />
            <Route path="/admin/support" element={<AdminPage section="support"><AdminPlaceholder title="Support" description="Help and support resources." /></AdminPage>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </SearchContextProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
