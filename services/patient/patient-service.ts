"use client";

import type {
  PatientWeeklyCalendarResponse,
  UpsertPatientCalendarLogPayload,
  UpsertPatientCalendarLogResponse,
} from "@/lib/calendar/types";
import type {
  CreatePatientRequestPayload,
  PatientDashboardResponse,
} from "@/lib/patient/types";

async function getAccessToken() {
  const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
  const supabase = createBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function patientFetch<T>(input: string, init?: RequestInit) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Tu sesion expiro. Volve a iniciar sesion.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const result = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo completar la solicitud.");
  }

  return result;
}

export function getPatientDashboard() {
  return patientFetch<PatientDashboardResponse>("/api/patient/dashboard");
}

export function getPatientWeeklyCalendar(weekStart?: string) {
  const search = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  return patientFetch<PatientWeeklyCalendarResponse>(`/api/patient/calendar${search}`);
}

export function upsertPatientCalendarLog(payload: UpsertPatientCalendarLogPayload) {
  return patientFetch<UpsertPatientCalendarLogResponse>("/api/patient/calendar/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createPatientRequest(payload: CreatePatientRequestPayload) {
  return patientFetch<{ prescription_request_id: number; message: string }>(
    "/api/patient/requests",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}
