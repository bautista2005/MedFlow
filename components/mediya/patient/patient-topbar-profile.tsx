"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPatientDashboard } from "@/services/patient/patient-service";
import { AppUserMenu } from "@/components/mediya/app-user-menu";

export function PatientTopbarProfile() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("Paciente");

  useEffect(() => {
    getPatientDashboard()
      .then((result) => setPatientName(result.patient.name))
      .catch(() => setPatientName("Paciente"));
  }, []);

  async function handleLogout() {
    const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
    const supabase = createBrowserSupabaseClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const normalizedName = patientName.trim() || "Paciente";
  const initial = normalizedName.charAt(0).toUpperCase() || "P";

  return (
    <AppUserMenu
      roleLabel="Paciente"
      greeting={`Hola, ${normalizedName}`}
      name={normalizedName}
      initial={initial}
      onLogout={handleLogout}
    />
  );
}
