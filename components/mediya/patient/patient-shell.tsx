import type { ReactNode } from "react";

import { Logo } from "@/components/mediya/logo";
import { PatientAccessGuard } from "@/components/mediya/patient/patient-access-guard";
import { PatientChatbotLauncher } from "@/components/mediya/patient/patient-chatbot-launcher";
import { PatientTopbarNav } from "@/components/mediya/patient/patient-topbar-nav";
import { PatientTopbarProfile } from "@/components/mediya/patient/patient-topbar-profile";

type PatientShellProps = {
  children: ReactNode;
};

export function PatientShell({ children }: PatientShellProps) {
  return (
    <PatientAccessGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_22%),linear-gradient(180deg,_#F8FBFF_0%,_#F2F7FF_48%,_#F9FAFB_100%)]">
        <header className="relative z-20 border-b border-slate-200/80 bg-white/88 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:px-10 lg:px-12">
            <div className="flex items-center justify-between gap-4">
              <Logo href="/paciente" />
              <PatientTopbarProfile />
            </div>
            <div className="flex justify-start">
              <PatientTopbarNav />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:px-12">
          {children}
        </main>
        <PatientChatbotLauncher />
      </div>
    </PatientAccessGuard>
  );
}
