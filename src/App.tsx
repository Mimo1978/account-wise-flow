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

const queryClient = new QueryClient();

const App = () => {
  // Global safety net for unhandled async errors (prevents white-screen crashes)
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
            {/* ========================================
                PUBLIC ROUTES - NO AUTH REQUIRED
                These routes are accessible to everyone
                ======================================== */}
            
            {/* Marketing Pages */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Authentication Pages */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/signup" element={<Navigate to="/auth" replace />} />
            <Route path="/auth/sign-in" element={<Navigate to="/auth?tab=signin" replace />} />
            <Route path="/auth/sign-up" element={<Navigate to="/auth?tab=signup" replace />} />

            {/* Public Demo Route - Sandbox with mock data, no auth required */}
            <Route path="/demo" element={<Demo />} />

            {/* ========================================
                PROTECTED ROUTES - AUTH REQUIRED
                Only authenticated users can access these
                CRM application routes
                ======================================== */}
            
            {/* Workspace Selector - Choose between demo and real workspace */}
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <WorkspaceSelector />
                </ProtectedRoute>
              }
            />
            
            {/* Authenticated Demo Workspace - Full features with demo data isolation */}
            <Route
              path="/demo-workspace"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <DemoWorkspace />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/canvas"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <Canvas />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Database Routes - Company-First Architecture */}
            {/* /database redirects to /companies as the primary landing */}
            <Route
              path="/database"
              element={<Navigate to="/companies" replace />}
            />
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <CompaniesDatabase />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <ContactsDatabase />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/talent"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <TalentDatabase />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/talent/:candidateId"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <CandidateProfile />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/outreach"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <Outreach />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <ExecutiveInsights />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Import Review Page */}
            <Route
              path="/imports/:batchId/review"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <ImportReview />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            
            {/* Workspace Settings */}
            <Route
              path="/workspace-settings"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <WorkspaceSettings />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Catch-all for 404 */}
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
