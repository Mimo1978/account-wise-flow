import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/canvas";
      const hasAuthCode = !!params.get("code");

      try {
        if (hasAuthCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }

        // If we're already signed in (email/password flow), just continue.
        navigate(next, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Authentication callback failed.";
        navigate("/auth", {
          replace: true,
          state: { error: message, from: { pathname: next } },
        });
      }
    };

    run();
  }, [navigate, location.key]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
