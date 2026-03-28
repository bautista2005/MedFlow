"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { resolveSessionRole } from "@/services/auth/auth-service";

type PatientAccessGuardProps = {
  children: React.ReactNode;
};

export function PatientAccessGuard({ children }: PatientAccessGuardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifyPatientAccess() {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const result = await resolveSessionRole(session.access_token);

      if (result.role !== "patient") {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!cancelled) {
        setStatus("ready");
      }
    }

    verifyPatientAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status !== "ready") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-6xl items-center justify-center px-6 py-10 md:px-10">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 px-8 py-6 text-sm text-emerald-950/70 shadow-[0_24px_80px_rgba(8,73,61,0.12)]">
          Validando sesion del paciente...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
