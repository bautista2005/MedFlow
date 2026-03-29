"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { getDoctorProfile, listDoctorAlerts, listDoctorRequests } from "@/services/doctor/doctor-service";
import { DoctorNotificationsPanel } from "@/components/mediya/doctor/doctor-notifications-panel";
import { AppUserMenu } from "@/components/mediya/app-user-menu";
import type { DoctorAlertsResponse, DoctorRequestsResponse } from "@/lib/doctor/types";

const DISMISSED_REQUESTS_STORAGE_KEY = "mediya:doctor-dismissed-requests";

function requiresDoctorAction(status: DoctorRequestsResponse["requests"][number]["status"]) {
  return status === "pending" || status === "reviewed";
}

export function DoctorTopbarProfile() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("Doctor");
  const [requests, setRequests] = useState<DoctorRequestsResponse["requests"]>([]);
  const [alerts, setAlerts] = useState<DoctorAlertsResponse["alerts"]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dismissedRequestIds, setDismissedRequestIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const storedValue = window.sessionStorage.getItem(DISMISSED_REQUESTS_STORAGE_KEY);

      if (!storedValue) {
        return;
      }

      const parsedValue = JSON.parse(storedValue) as unknown;
      setDismissedRequestIds(
        Array.isArray(parsedValue)
          ? parsedValue.filter((value): value is number => typeof value === "number")
          : [],
      );
    } catch {
      setDismissedRequestIds([]);
    }
  }, []);

  useEffect(() => {
    getDoctorProfile()
      .then((result) => setDoctorName(result.doctor.name))
      .catch(() => setDoctorName("Doctor"));
  }, []);

  useEffect(() => {
    Promise.allSettled([listDoctorRequests(), listDoctorAlerts()])
      .then(([requestsResult, alertsResult]) => {
        setRequests(requestsResult.status === "fulfilled" ? requestsResult.value.requests : []);
        setAlerts(alertsResult.status === "fulfilled" ? alertsResult.value.alerts : []);
      })
      .catch(() => {
        setRequests([]);
        setAlerts([]);
      });
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
  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          requiresDoctorAction(request.status) &&
          !dismissedRequestIds.includes(request.prescription_request_id),
      ),
    [dismissedRequestIds, requests],
  );
  const openAlerts = useMemo(
    () => alerts.filter((alert) => alert.status !== "closed"),
    [alerts],
  );
  const actionableNotificationCount = openAlerts.length + pendingRequests.length;

  function handleAlertClosed(alertId: number) {
    setAlerts((currentAlerts) =>
      currentAlerts.filter((alert) => alert.doctor_patient_alert_id !== alertId),
    );
  }

  function handleRequestDismissed(requestId: number) {
    setDismissedRequestIds((currentIds) => {
      if (currentIds.includes(requestId)) {
        return currentIds;
      }

      const nextIds = [...currentIds, requestId];
      window.sessionStorage.setItem(DISMISSED_REQUESTS_STORAGE_KEY, JSON.stringify(nextIds));
      return nextIds;
    });
  }

  return (
    <>
      <div className="relative z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsNotificationsOpen(true)}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
          aria-label="Abrir notificaciones"
          aria-expanded={isNotificationsOpen}
          aria-controls="doctor-notifications-drawer"
        >
          <Bell className="h-5 w-5" />
          {actionableNotificationCount > 0 ? (
            <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {actionableNotificationCount}
            </span>
          ) : null}
        </button>

        <AppUserMenu
          roleLabel="Profesional"
          greeting={`Hola, Dr./a ${normalizedDoctorName || doctorName}`}
          name={normalizedDoctorName || doctorName}
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
            id="doctor-notifications-drawer"
            className="fixed top-0 right-0 bottom-0 z-50 h-dvh w-full md:max-w-[32rem] animate-[mediya-slide-in-right_220ms_ease-out]"
          >
            <DoctorNotificationsPanel
              alerts={openAlerts}
              requests={pendingRequests}
              onAlertClosed={handleAlertClosed}
              onRequestDismissed={handleRequestDismissed}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
