import type { ReactNode } from "react";

import { DoctorShell } from "@/components/mediya/doctor/doctor-shell";

export default function DoctorLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DoctorShell>{children}</DoctorShell>;
}
