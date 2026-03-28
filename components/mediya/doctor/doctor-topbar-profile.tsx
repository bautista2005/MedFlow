"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDoctorProfile } from "@/services/doctor/doctor-service";
import { AppUserMenu } from "@/components/mediya/app-user-menu";

export function DoctorTopbarProfile() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("Doctor");

  useEffect(() => {
    getDoctorProfile()
      .then((result) => setDoctorName(result.doctor.name))
      .catch(() => setDoctorName("Doctor"));
  }, []);

  async function handleLogout() {
    const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
    const supabase = createBrowserSupabaseClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const normalizedDoctorName = doctorName
    .replace(/^\s*(dr\/a\.?|dra?\.?|doctora?|doctora)\s+/i, "")
    .trim();
  const initial = (normalizedDoctorName || doctorName).trim().charAt(0).toUpperCase() || "D";

  return (
    <AppUserMenu
      roleLabel="Profesional"
      greeting={`Hola, Dr./a ${normalizedDoctorName || doctorName}`}
      name={normalizedDoctorName || doctorName}
      initial={initial}
      onLogout={handleLogout}
    />
  );
}
