import type { ReactNode } from "react";

import { PatientShell } from "@/components/mediya/patient/patient-shell";

export default function PatientLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PatientShell>{children}</PatientShell>;
}
