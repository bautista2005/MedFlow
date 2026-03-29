"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  getPatientDashboard,
  listPatientNotifications,
} from "@/services/patient/patient-service";
import { AppUserMenu } from "@/components/mediya/app-user-menu";
import { PatientNotificationsDrawer } from "@/components/mediya/patient/patient-notifications-drawer";
import type { PatientNotificationListResponse } from "@/lib/patient/types";

export function PatientTopbarProfile() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("Paciente");
  const [notifications, setNotifications] = useState<PatientNotificationListResponse>({
    notifications: [],
    unread_count: 0,
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    getPatientDashboard()
      .then((result) => setPatientName(result.patient.name))
      .catch(() => setPatientName("Paciente"));
  }, []);

  useEffect(() => {
    listPatientNotifications({ status: "unread" })
      .then((result) => setNotifications(result))
      .catch(() =>
        setNotifications({
          notifications: [],
          unread_count: 0,
        }),
      );
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationsOpen]);

  async function openNotifications() {
    try {
      const result = await listPatientNotifications({ status: "unread" });
      setNotifications(result);
    } catch {
      setNotifications({
        notifications: [],
        unread_count: 0,
      });
    }

    setIsNotificationsOpen(true);
  }

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
    <>
      <div className="relative z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void openNotifications()}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
        aria-label="Abrir notificaciones"
          aria-expanded={isNotificationsOpen}
          aria-controls="patient-notifications-drawer"
      >
        <Bell className="h-5 w-5" />
          {notifications.unread_count > 0 ? (
          <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {notifications.unread_count}
          </span>
        ) : null}
        </button>

        <AppUserMenu
          roleLabel="Paciente"
          greeting={`Hola, ${normalizedName}`}
          name={normalizedName}
          initial={initial}
          onLogout={handleLogout}
        />
      </div>

      {isNotificationsOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 bg-slate-950/24"
            aria-label="Cerrar notificaciones"
            onClick={() => setIsNotificationsOpen(false)}
          />
          <div
            id="patient-notifications-drawer"
            className="fixed top-0 right-0 bottom-0 z-50 h-dvh w-full animate-[mediya-slide-in-right_220ms_ease-out] md:max-w-[32rem]"
          >
            <PatientNotificationsDrawer
              notifications={notifications.notifications}
              unreadCount={notifications.unread_count}
              onNotificationsChange={setNotifications}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
