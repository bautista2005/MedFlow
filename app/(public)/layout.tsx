import type { ReactNode } from "react";

import { SiteHeader } from "@/components/mediya/site-header";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.20),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_24%),linear-gradient(180deg,_#eff6ff_0%,_#f8fbff_45%,_#ffffff_100%)]">
      <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
      <SiteHeader />
      <main className="relative z-10">{children}</main>
    </div>
  );
}
