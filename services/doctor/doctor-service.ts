"use client";

import type { DoctorWeeklyCalendarResponse } from "@/lib/calendar/types";
import type {
  CreatePatientPayload,
  CreatePatientTreatmentPayload,
  DoctorAlertsResponse,
  DoctorProfileResponse,
  DoctorRequestsResponse,
  PatientDetail,
  PatientsIndexResponse,
  SendDoctorPatientNotificationPayload,
  UpdateDoctorAlertStatusPayload,
  UpdateDoctorRequestPharmacyStatusPayload,
  UpdateDoctorRequestNotePayload,
} from "@/lib/doctor/types";

async function getAccessToken() {
  const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
  const supabase = createBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function doctorFetch<T>(input: string, init?: RequestInit) {
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

export function listDoctorPatients() {
  return doctorFetch<PatientsIndexResponse>("/api/doctor/patients");
}

export function listDoctorAlerts(includeClosed = false) {
  const search = includeClosed ? "?includeClosed=true" : "";
  return doctorFetch<DoctorAlertsResponse>(`/api/doctor/alerts${search}`);
}

export function getDoctorProfile() {
  return doctorFetch<DoctorProfileResponse>("/api/doctor/profile");
}

export function createDoctorPatient(payload: CreatePatientPayload) {
  return doctorFetch<{ patient_id: number; message: string }>("/api/doctor/patients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getDoctorPatientDetail(patientId: string) {
  return doctorFetch<PatientDetail>(`/api/doctor/patients/${patientId}`);
}

export function updateDoctorAlertStatus(
  alertId: number,
  payload: UpdateDoctorAlertStatusPayload,
) {
  return doctorFetch<{ alert: DoctorAlertsResponse["alerts"][number]; message: string }>(
    `/api/doctor/alerts/${alertId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function sendDoctorPatientNotification(
  patientId: string,
  payload: SendDoctorPatientNotificationPayload,
) {
  return doctorFetch<{ message: string }>(`/api/doctor/patients/${patientId}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getDoctorPatientWeeklyCalendar(patientId: string, weekStart?: string) {
  const search = weekStart
    ? `?${new URLSearchParams({ weekStart }).toString()}`
    : "";

  return doctorFetch<DoctorWeeklyCalendarResponse>(
    `/api/doctor/patients/${patientId}/calendar${search}`,
  );
}

export function createDoctorPatientTreatment(
  patientId: string,
  payload: CreatePatientTreatmentPayload,
) {
  return doctorFetch<{ patient_medication_id: number; message: string }>(
    `/api/doctor/patients/${patientId}/medications`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function listDoctorRequests() {
  return doctorFetch<DoctorRequestsResponse>("/api/doctor/requests");
}

export function uploadDoctorPrescriptionFile(requestId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return doctorFetch<{ message: string }>(
    `/api/doctor/requests/${requestId}/files`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export function updateDoctorRequestNote(
  requestId: number,
  payload: UpdateDoctorRequestNotePayload,
) {
  return doctorFetch<{ message: string; doctor_note: string; status: string }>(
    `/api/doctor/requests/${requestId}/note`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function updateDoctorRequestPharmacyStatus(
  requestId: number,
  payload: UpdateDoctorRequestPharmacyStatusPayload,
) {
  return doctorFetch<{ message: string; status: string }>(
    `/api/doctor/requests/${requestId}/pharmacy-status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}
