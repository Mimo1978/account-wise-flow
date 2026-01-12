import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProductLayout } from "@/components/layout/ProductLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Canvas from "./pages/Canvas";
import ContactsDatabase from "./pages/ContactsDatabase";
import CompaniesDatabase from "./pages/CompaniesDatabase";
import TalentDatabase from "./pages/TalentDatabase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Marketing Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Product Routes */}
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
              path="/talent"
              element={
                <ProtectedRoute>
                  <ProductLayout>
                    <TalentDatabase />
                  </ProductLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
