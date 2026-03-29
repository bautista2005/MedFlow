"use client";

import type {
  PatientWeeklyCalendarResponse,
  UpsertPatientCalendarLogPayload,
  UpsertPatientCalendarLogResponse,
} from "@/lib/calendar/types";
import type {
  PatientChatHistoryResponse,
  CreatePatientRequestPayload,
  PatientChatMessagePayload,
  PatientChatMessageResponse,
  PatientDashboardResponse,
  PatientNotificationListResponse,
  PatientNotificationStatusFilter,
  UpdatePatientAlternativePharmacyPayload,
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

export function sendPatientChatMessage(payload: PatientChatMessagePayload) {
  return patientFetch<PatientChatMessageResponse>("/api/patient/chatbot/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getPatientChatHistory(limit = 20) {
  const search = `?limit=${encodeURIComponent(String(limit))}`;
  return patientFetch<PatientChatHistoryResponse>(`/api/patient/chatbot/history${search}`);
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

export function updatePatientAlternativePharmacy(
  requestId: number,
  payload: UpdatePatientAlternativePharmacyPayload,
) {
  return patientFetch<{ message: string; status: string }>(
    `/api/patient/requests/${requestId}/alternative-pharmacy`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

type ListPatientNotificationsOptions = {
  status?: PatientNotificationStatusFilter;
  limit?: number;
};

export function listPatientNotifications(options: ListPatientNotificationsOptions = {}) {
  const searchParams = new URLSearchParams();
  const status = options.status ?? "all";

  if (status !== "all") {
    searchParams.set("status", status);
  }

  if (typeof options.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }

  const search = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

  return patientFetch<PatientNotificationListResponse>(`/api/patient/notifications${search}`);
}

export function getPatientNotificationPreview() {
  return listPatientNotifications({ status: "unread", limit: 3 });
}

export async function getPatientNotificationBadgeSummary() {
  const result = await listPatientNotifications({
    status: "unread",
    limit: 1,
  });

  return {
    unread_count: result.unread_count,
  };
}

export function markPatientNotificationAsRead(notificationId: number) {
  return patientFetch<{ deleted_notification_id: number; message: string }>(
    `/api/patient/notifications/${notificationId}`,
    {
      method: "PATCH",
    },
  );
}

export function markAllPatientNotificationsAsRead() {
  return patientFetch<{ updated_count: number; message: string }>(
    "/api/patient/notifications/read-all",
    {
      method: "POST",
    },
  );
}
