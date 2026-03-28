import type { ReactNode } from "react";

import { Logo } from "@/components/mediya/logo";
import { DoctorAccessGuard } from "@/components/mediya/doctor/doctor-access-guard";
import { DoctorTopbarProfile } from "@/components/mediya/doctor/doctor-topbar-profile";

type DoctorShellProps = {
  children: ReactNode;
};

export function DoctorShell({ children }: DoctorShellProps) {
  return (
    <DoctorAccessGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_22%),linear-gradient(180deg,_#F8FBFF_0%,_#F2F7FF_48%,_#F9FAFB_100%)]">
        <header className="relative z-20 border-b border-slate-200/80 bg-white/88 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-10 lg:px-12">
            <Logo href="/panel" />
            <DoctorTopbarProfile />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:px-12">
          {children}
        </main>
      </div>
    </DoctorAccessGuard>
  );
}
