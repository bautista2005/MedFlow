import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import {
  getPatientFollowUpNotificationCounts,
  getPatientRiskIndicators,
  listDoctorAlerts,
} from "@/lib/chatbot/alerts";
import { normalizeWeeklyScheduleSummary } from "@/lib/calendar/utils";
import { autoAdvancePrescriptionRequests } from "@/lib/patient/notifications";
import type {
  PatientDetail,
  PatientMedicationSummary,
  PrescriptionFileSummary,
  PrescriptionRequestSummary,
} from "@/lib/doctor/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type WeeklyScheduleRelation = {
  weekly_schedule_config_id: number;
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[] | null;
  intake_slots: unknown;
  notes: string | null;
};

type PatientContext = {
  params: Promise<{
    patientId: string;
  }>;
};

type PatientRecord = {
  patient_id: number;
  name: string;
  dni: string;
  email: string;
  phone: string | null;
  address: string | null;
  zone: string | null;
  account_status: "invited" | "active" | "disabled";
  pharmacies:
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }[]
    | null;
};

type RequestRecord = {
  prescription_request_id: number;
  patient_id: number;
  status: PrescriptionRequestSummary["status"];
  requested_at: string;
  resolved_at: string | null;
  patient_note: string | null;
  doctor_note: string | null;
  medication_name_snapshot: string;
  preferred_pharmacy:
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }[]
    | null;
  assigned_pharmacy:
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }[]
    | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: Request, context: PatientContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { patientId } = await context.params;
    const parsedPatientId = Number(patientId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
      return NextResponse.json({ error: "Paciente invalido." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: patientLink, error: patientError } = await supabase
      .from("patient_doctors")
      .select(
        "patients!inner(patient_id, name, dni, email, phone, address, zone, account_status, pharmacies(pharmacy_id, name, zone, city))",
      )
      .eq("active_doctor_id", doctor.activeDoctorId)
      .eq("patient_id", parsedPatientId)
      .maybeSingle();

    if (patientError) {
      return NextResponse.json(
        { error: "No se pudo cargar el paciente." },
        { status: 500 },
      );
    }

    if (!patientLink?.patients) {
      return NextResponse.json(
        { error: "El paciente no pertenece al medico autenticado." },
        { status: 404 },
      );
    }

    const patient = normalizeRelation(
      patientLink.patients as unknown as PatientRecord | PatientRecord[] | null,
    );

    if (!patient) {
      return NextResponse.json(
        { error: "El paciente no pertenece al medico autenticado." },
        { status: 404 },
      );
    }

    await autoAdvancePrescriptionRequests({
      activeDoctorId: doctor.activeDoctorId,
      patientId: parsedPatientId,
    });

    const [{ data: medications, error: medicationsError }, { data: requests, error: requestsError }] =
      await Promise.all([
        supabase
          .from("patient_medications")
          .select(
            "patient_medication_id, medication_name, dose_text, frequency_text, pills_per_box, box_count, units_per_intake, intakes_per_day, start_date, next_consultation_at, notes, is_active, weekly_schedule_configs(weekly_schedule_config_id, is_enabled, schedule_start_date, schedule_end_date, days_of_week, intake_slots, notes)",
          )
          .eq("patient_id", parsedPatientId)
          .eq("active_doctor_id", doctor.activeDoctorId)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("prescription_requests")
          .select(
            "prescription_request_id, patient_id, status, requested_at, resolved_at, patient_note, doctor_note, medication_name_snapshot, preferred_pharmacy:pharmacies!prescription_requests_preferred_pharmacy_id_fkey(pharmacy_id, name, zone, city), assigned_pharmacy:pharmacies!prescription_requests_assigned_pharmacy_id_fkey(pharmacy_id, name, zone, city)",
          )
          .eq("patient_id", parsedPatientId)
          .eq("active_doctor_id", doctor.activeDoctorId)
          .order("requested_at", { ascending: false })
          .limit(10),
      ]);

    if (medicationsError || requestsError) {
      return NextResponse.json(
        { error: "No se pudo cargar el detalle del paciente." },
        { status: 500 },
      );
    }

    const requestIds = (requests ?? []).map((item) => item.prescription_request_id);
    const [riskIndicators, doctorAlerts, followUpNotificationCounts] = await Promise.all([
      getPatientRiskIndicators([parsedPatientId]),
      listDoctorAlerts({
        activeDoctorId: doctor.activeDoctorId,
      }),
      getPatientFollowUpNotificationCounts({
        activeDoctorId: doctor.activeDoctorId,
        patientIds: [parsedPatientId],
      }),
    ]);
    const currentFiles =
      requestIds.length === 0
        ? []
        : (
            await supabase
              .from("prescription_files")
              .select(
                "prescription_file_id, prescription_request_id, original_filename, mime_type, uploaded_at, is_current",
              )
              .in("prescription_request_id", requestIds)
              .eq("is_current", true)
          ).data ?? [];

    const fileByRequestId = new Map<number, PrescriptionFileSummary>(
      currentFiles.map((file) => [
        file.prescription_request_id,
        {
          prescription_file_id: file.prescription_file_id,
          original_filename: file.original_filename,
          mime_type: file.mime_type,
          uploaded_at: file.uploaded_at,
          is_current: file.is_current,
        },
      ]),
    );

    const risk = riskIndicators.get(parsedPatientId);

    const response: PatientDetail = {
      patient_id: patient.patient_id,
      name: patient.name,
      dni: patient.dni,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      zone: patient.zone,
      account_status: patient.account_status,
      preferred_pharmacy: normalizeRelation(patient.pharmacies),
      risk_status: risk?.risk_status ?? null,
      risk_score: risk?.risk_score ?? null,
      last_alert_at: risk?.last_alert_at ?? null,
      follow_up_notification_count: followUpNotificationCounts.get(parsedPatientId) ?? 0,
      medications: ((medications ?? []) as (Omit<PatientMedicationSummary, "weekly_schedule"> & {
        weekly_schedule_configs: WeeklyScheduleRelation | WeeklyScheduleRelation[] | null;
      })[]).map((medication) => ({
        patient_medication_id: medication.patient_medication_id,
        medication_name: medication.medication_name,
        dose_text: medication.dose_text,
        frequency_text: medication.frequency_text,
        pills_per_box: medication.pills_per_box,
        box_count: medication.box_count,
        units_per_intake: medication.units_per_intake,
        intakes_per_day: medication.intakes_per_day,
        start_date: medication.start_date,
        next_consultation_at: medication.next_consultation_at,
        notes: medication.notes,
        is_active: medication.is_active,
        weekly_schedule: normalizeWeeklyScheduleSummary(medication.weekly_schedule_configs),
      })),
      requests: ((requests ?? []) as RequestRecord[]).map((item) => ({
        prescription_request_id: item.prescription_request_id,
        patient_id: item.patient_id,
        patient_name: patient.name,
        medication_name: item.medication_name_snapshot,
        status: item.status,
        requested_at: item.requested_at,
        resolved_at: item.resolved_at,
        patient_note: item.patient_note,
        doctor_note: item.doctor_note,
        preferred_pharmacy: normalizeRelation(item.preferred_pharmacy),
        assigned_pharmacy: normalizeRelation(item.assigned_pharmacy),
        current_file: fileByRequestId.get(item.prescription_request_id) ?? null,
      })),
      recent_alerts: doctorAlerts.filter((alert) => alert.patient_id === parsedPatientId).slice(0, 5),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el detalle del paciente." },
      { status: 500 },
    );
  }
}
