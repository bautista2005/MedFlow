import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import { normalizeWeeklyScheduleSummary } from "@/lib/calendar/utils";
import { calculateMedicationStatus } from "@/lib/patient/medication-calculations";
import { createSystemNotification } from "@/lib/patient/notifications";
import { ACTIVE_PRESCRIPTION_REQUEST_STATUSES } from "@/lib/patient/types";
import type {
  DoctorSummary,
  PatientDashboardResponse,
  PatientMedicationSummary,
  PatientRequestSummary,
  PharmacySummary,
  PrescriptionFileSummary,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const FOLLOW_UP_REMINDER_WINDOW_DAYS = 7;

type WeeklyScheduleRelation = {
  weekly_schedule_config_id: number;
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[] | null;
  intake_slots: unknown;
  notes: string | null;
};

type MedicationRow = {
  patient_medication_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  frequency_text: string;
  pills_per_box: number | null;
  box_count: number;
  units_per_intake: number | null;
  intakes_per_day: number | null;
  notes: string | null;
  is_active: boolean;
  start_date: string;
  next_consultation_at: string | null;
  active_doctor_id: number;
  weekly_schedule_configs: WeeklyScheduleRelation | WeeklyScheduleRelation[] | null;
  active_doctors: DoctorSummary | DoctorSummary[];
};

type RequestRow = {
  prescription_request_id: number;
  patient_medication_id: number;
  status: PrescriptionRequestStatus;
  requested_at: string;
  resolved_at: string | null;
  patient_note: string | null;
  doctor_note: string | null;
  medication_name_snapshot: string;
  preferred_pharmacy:
    | PharmacySummary
    | PharmacySummary[]
    | null;
  assigned_pharmacy:
    | PharmacySummary
    | PharmacySummary[]
    | null;
};

type FileRow = PrescriptionFileSummary & {
  prescription_request_id: number;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapRequest(
  row: RequestRow,
  currentFile: PrescriptionFileSummary | null,
): PatientRequestSummary {
  return {
    prescription_request_id: row.prescription_request_id,
    patient_medication_id: row.patient_medication_id,
    medication_name: row.medication_name_snapshot,
    status: row.status,
    requested_at: row.requested_at,
    resolved_at: row.resolved_at,
    patient_note: row.patient_note,
    doctor_note: row.doctor_note,
    preferred_pharmacy: normalizeRelation(row.preferred_pharmacy),
    assigned_pharmacy: normalizeRelation(row.assigned_pharmacy),
    current_file: currentFile,
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function isFollowUpReminderDue(nextConsultationAt: string | null) {
  if (!nextConsultationAt) {
    return false;
  }

  const consultationDate = new Date(nextConsultationAt);

  if (Number.isNaN(consultationDate.getTime())) {
    return false;
  }

  const remainingDays = diffDays(startOfUtcDay(new Date()), startOfUtcDay(consultationDate));
  return remainingDays >= 0 && remainingDays <= FOLLOW_UP_REMINDER_WINDOW_DAYS;
}

async function emitPatientDashboardSystemNotifications(
  patientId: number,
  medications: PatientMedicationSummary[],
) {
  const writes = medications.flatMap((medication) => {
    if (!medication.is_active) {
      return [];
    }

    const operations: Promise<unknown>[] = [];

    if (
      medication.calculation.can_calculate &&
      medication.calculation.can_request_refill &&
      medication.calculation.status_tone !== "success" &&
      !ACTIVE_PRESCRIPTION_REQUEST_STATUSES.includes(
        medication.latest_request?.status ?? "cancelled",
      )
    ) {
      operations.push(
        createSystemNotification({
          type: "medication_running_low",
          patientId,
          activeDoctorId: medication.doctor.active_doctor_id,
          patientMedicationId: medication.patient_medication_id,
          medicationName: medication.medication_name,
          remainingDays: medication.calculation.remaining_days,
        }),
      );
    }

    if (isFollowUpReminderDue(medication.next_consultation_at)) {
      operations.push(
        createSystemNotification({
          type: "follow_up_reminder",
          patientId,
          activeDoctorId: medication.doctor.active_doctor_id,
          patientMedicationId: medication.patient_medication_id,
          medicationName: medication.medication_name,
          nextConsultationAt: medication.next_consultation_at,
        }),
      );
    }

    return operations;
  });

  if (writes.length === 0) {
    return;
  }

  await Promise.allSettled(writes);
}

export async function GET(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const supabase = createAdminSupabaseClient();

    const [
      { data: patientRow, error: patientError },
      { data: medicationRows, error: medicationsError },
      { data: requestRows, error: requestsError },
      { data: pharmacies, error: pharmaciesError },
    ] =
      await Promise.all([
        supabase
          .from("patients")
          .select(
            "patient_id, name, email, phone, zone, account_status, pharmacies(pharmacy_id, name, zone, city)",
          )
          .eq("patient_id", patient.patientId)
          .maybeSingle(),
        supabase
          .from("patient_medications")
          .select(
            "patient_medication_id, medication_name, presentation, dose_text, frequency_text, pills_per_box, box_count, units_per_intake, intakes_per_day, notes, is_active, start_date, next_consultation_at, active_doctor_id, weekly_schedule_configs(weekly_schedule_config_id, is_enabled, schedule_start_date, schedule_end_date, days_of_week, intake_slots, notes), active_doctors(active_doctor_id, name, email, organization)",
          )
          .eq("patient_id", patient.patientId)
          .order("is_active", { ascending: false })
          .order("start_date", { ascending: false }),
        supabase
          .from("prescription_requests")
          .select(
            "prescription_request_id, patient_medication_id, status, requested_at, resolved_at, patient_note, doctor_note, medication_name_snapshot, preferred_pharmacy:pharmacies!prescription_requests_preferred_pharmacy_id_fkey(pharmacy_id, name, zone, city), assigned_pharmacy:pharmacies!prescription_requests_assigned_pharmacy_id_fkey(pharmacy_id, name, zone, city)",
          )
          .eq("patient_id", patient.patientId)
          .order("requested_at", { ascending: false }),
        supabase
          .from("pharmacies")
          .select("pharmacy_id, name, zone, city")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

    if (patientError || medicationsError || requestsError || pharmaciesError || !patientRow) {
      return NextResponse.json(
        { error: "No se pudo cargar el panel del paciente." },
        { status: 500 },
      );
    }

    const requestIds = ((requestRows ?? []) as RequestRow[]).map(
      (item) => item.prescription_request_id,
    );
    const { data: currentFiles, error: filesError } =
      requestIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("prescription_files")
            .select(
              "prescription_file_id, prescription_request_id, original_filename, mime_type, uploaded_at, is_current",
            )
            .in("prescription_request_id", requestIds)
            .eq("is_current", true);

    if (filesError) {
      return NextResponse.json(
        { error: "No se pudo cargar el panel del paciente." },
        { status: 500 },
      );
    }

    const fileByRequestId = new Map<number, PrescriptionFileSummary>(
      ((currentFiles ?? []) as FileRow[]).map((file) => [
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

    const requests = ((requestRows ?? []) as RequestRow[]).map((row) =>
      mapRequest(row, fileByRequestId.get(row.prescription_request_id) ?? null),
    );

    const latestRequestByMedicationId = new Map<number, PatientRequestSummary>();

    for (const requestItem of requests) {
      if (!latestRequestByMedicationId.has(requestItem.patient_medication_id)) {
        latestRequestByMedicationId.set(requestItem.patient_medication_id, requestItem);
      }
    }

    const medications: PatientMedicationSummary[] = ((medicationRows ?? []) as MedicationRow[]).map(
      (row) => {
        const latestRequest =
          latestRequestByMedicationId.get(row.patient_medication_id) ?? null;
        const hasOpenRequest = ACTIVE_PRESCRIPTION_REQUEST_STATUSES.includes(
          latestRequest?.status ?? "cancelled",
        );

        return {
          patient_medication_id: row.patient_medication_id,
          medication_name: row.medication_name,
          presentation: row.presentation,
          dose_text: row.dose_text,
          frequency_text: row.frequency_text,
          pills_per_box: row.pills_per_box,
          box_count: row.box_count,
          units_per_intake: row.units_per_intake,
          intakes_per_day: row.intakes_per_day,
          notes: row.notes,
          is_active: row.is_active,
          weekly_schedule: normalizeWeeklyScheduleSummary(row.weekly_schedule_configs),
          start_date: row.start_date,
          next_consultation_at: row.next_consultation_at,
          doctor:
            normalizeRelation(row.active_doctors) ??
            ({
              active_doctor_id: row.active_doctor_id,
              name: "Medico asignado",
              email: "",
              organization: "",
            } satisfies DoctorSummary),
          latest_request: latestRequest,
          calculation: calculateMedicationStatus(
            {
              pills_per_box: row.pills_per_box,
              box_count: row.box_count,
              units_per_intake: row.units_per_intake,
              intakes_per_day: row.intakes_per_day,
              start_date: row.start_date,
            },
            { hasOpenRequest },
          ),
        };
      },
    );

    const response: PatientDashboardResponse = {
      patient: {
        patient_id: patientRow.patient_id,
        name: patientRow.name,
        email: patientRow.email,
        phone: patientRow.phone,
        zone: patientRow.zone,
        account_status: patientRow.account_status,
        preferred_pharmacy: normalizeRelation(patientRow.pharmacies),
      },
      medications,
      requests,
      pharmacies: (pharmacies ?? []) as PharmacySummary[],
    };

    await emitPatientDashboardSystemNotifications(patient.patientId, medications);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el panel del paciente." },
      { status: 500 },
    );
  }
}
