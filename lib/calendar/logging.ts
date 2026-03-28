import type {
  PatientCalendarLogStatus,
  UpsertPatientCalendarLogPayload,
  UpsertPatientCalendarLogResponse,
  WeeklyScheduleLogSummary,
  WeeklyScheduleSlot,
} from "@/lib/calendar/types";
import { getIsoWeekday, isIsoDateString, normalizeWeeklyScheduleSummary } from "@/lib/calendar/utils";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type WeeklyScheduleConfigRecord = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  patient_id: number;
  active_doctor_id: number;
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[] | null;
  intake_slots: unknown;
  notes: string | null;
};

type WeeklyScheduleLogRecord = {
  weekly_schedule_log_id: number;
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  scheduled_time: string | null;
  status: PatientCalendarLogStatus;
  recorded_by_role: "patient" | "doctor" | "system";
  recorded_by_auth_user_id: string | null;
  note: string | null;
  logged_at: string;
  taken_at: string | null;
};

const VALID_PATIENT_CALENDAR_STATUSES = new Set<PatientCalendarLogStatus>([
  "taken",
  "missed",
  "taken_late",
]);

export class PatientCalendarLogPayloadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PatientCalendarLogPayloadError";
    this.status = status;
  }
}

export class PatientCalendarLogOwnershipError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PatientCalendarLogOwnershipError";
    this.status = status;
  }
}

export class PatientCalendarLogNotFoundError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "PatientCalendarLogNotFoundError";
    this.status = status;
  }
}

function normalizePayload(
  payload: UpsertPatientCalendarLogPayload,
): UpsertPatientCalendarLogPayload {
  return {
    weekly_schedule_config_id: Number(payload.weekly_schedule_config_id),
    patient_medication_id: Number(payload.patient_medication_id),
    scheduled_for_date:
      typeof payload.scheduled_for_date === "string" ? payload.scheduled_for_date : "",
    slot_key: typeof payload.slot_key === "string" ? payload.slot_key.trim() : "",
    status: payload.status,
  };
}

function validatePayload(payload: UpsertPatientCalendarLogPayload) {
  if (!Number.isInteger(payload.weekly_schedule_config_id) || payload.weekly_schedule_config_id <= 0) {
    throw new PatientCalendarLogPayloadError("La configuracion semanal es invalida.");
  }

  if (!Number.isInteger(payload.patient_medication_id) || payload.patient_medication_id <= 0) {
    throw new PatientCalendarLogPayloadError("El tratamiento es invalido.");
  }

  if (!isIsoDateString(payload.scheduled_for_date)) {
    throw new PatientCalendarLogPayloadError("La fecha programada no es valida.");
  }

  if (!payload.slot_key) {
    throw new PatientCalendarLogPayloadError("La toma seleccionada es invalida.");
  }

  if (!VALID_PATIENT_CALENDAR_STATUSES.has(payload.status)) {
    throw new PatientCalendarLogPayloadError("El estado seleccionado no es valido.");
  }
}

function findMatchingSlot(slots: WeeklyScheduleSlot[], slotKey: string) {
  return slots.find((slot) => slot.slot_key === slotKey) ?? null;
}

function mapLogSummary(record: WeeklyScheduleLogRecord): WeeklyScheduleLogSummary {
  return {
    weekly_schedule_log_id: record.weekly_schedule_log_id,
    weekly_schedule_config_id: record.weekly_schedule_config_id,
    patient_medication_id: record.patient_medication_id,
    scheduled_for_date: record.scheduled_for_date,
    slot_key: record.slot_key,
    scheduled_time: record.scheduled_time,
    status: record.status,
    recorded_by_role: record.recorded_by_role,
    recorded_by_auth_user_id: record.recorded_by_auth_user_id,
    note: record.note,
    logged_at: record.logged_at,
    taken_at: record.taken_at,
  };
}

export async function upsertPatientCalendarLog({
  authUserId,
  patientId,
  payload,
}: {
  authUserId: string;
  patientId: number;
  payload: UpsertPatientCalendarLogPayload;
}): Promise<UpsertPatientCalendarLogResponse> {
  const normalizedPayload = normalizePayload(payload);
  validatePayload(normalizedPayload);

  const supabase = createAdminSupabaseClient();
  const { data: configRecord, error: configError } = await supabase
    .from("weekly_schedule_configs")
    .select(
      "weekly_schedule_config_id, patient_medication_id, patient_id, active_doctor_id, is_enabled, schedule_start_date, schedule_end_date, days_of_week, intake_slots, notes",
    )
    .eq("weekly_schedule_config_id", normalizedPayload.weekly_schedule_config_id)
    .maybeSingle();

  if (configError) {
    throw new Error("No se pudo validar la toma del calendario.");
  }

  if (!configRecord) {
    throw new PatientCalendarLogNotFoundError("La configuracion del calendario no existe.");
  }

  const schedule = normalizeWeeklyScheduleSummary(
    configRecord as WeeklyScheduleConfigRecord,
  );

  if (!schedule || !configRecord.is_enabled) {
    throw new PatientCalendarLogNotFoundError("La configuracion del calendario no esta activa.");
  }

  if (configRecord.patient_id !== patientId) {
    throw new PatientCalendarLogOwnershipError(
      "No podes editar tomas de otro paciente.",
    );
  }

  if (configRecord.patient_medication_id !== normalizedPayload.patient_medication_id) {
    throw new PatientCalendarLogOwnershipError(
      "La toma no pertenece al tratamiento indicado.",
    );
  }

  if (
    normalizedPayload.scheduled_for_date < schedule.schedule_start_date ||
    (schedule.schedule_end_date !== null &&
      normalizedPayload.scheduled_for_date > schedule.schedule_end_date)
  ) {
    throw new PatientCalendarLogPayloadError(
      "La fecha seleccionada queda fuera del rango del calendario semanal.",
    );
  }

  const scheduledWeekday = getIsoWeekday(normalizedPayload.scheduled_for_date);

  if (!schedule.days_of_week.includes(scheduledWeekday)) {
    throw new PatientCalendarLogPayloadError(
      "La fecha seleccionada no corresponde a un dia habilitado.",
    );
  }

  const slot = findMatchingSlot(schedule.intake_slots, normalizedPayload.slot_key);

  if (!slot) {
    throw new PatientCalendarLogPayloadError("La toma seleccionada no existe en el calendario.");
  }

  const nowIso = new Date().toISOString();
  const takenAt =
    normalizedPayload.status === "missed"
      ? null
      : nowIso;

  const writePayload = {
    weekly_schedule_config_id: configRecord.weekly_schedule_config_id,
    patient_medication_id: configRecord.patient_medication_id,
    patient_id: configRecord.patient_id,
    active_doctor_id: configRecord.active_doctor_id,
    scheduled_for_date: normalizedPayload.scheduled_for_date,
    slot_key: normalizedPayload.slot_key,
    scheduled_time: slot.time,
    status: normalizedPayload.status,
    recorded_by_role: "patient" as const,
    recorded_by_auth_user_id: authUserId,
    logged_at: nowIso,
    taken_at: takenAt,
    note: null,
  };

  const { data: existingLog, error: existingLogError } = await supabase
    .from("weekly_schedule_logs")
    .select(
      "weekly_schedule_log_id, weekly_schedule_config_id, patient_medication_id, scheduled_for_date, slot_key, scheduled_time, status, recorded_by_role, recorded_by_auth_user_id, note, logged_at, taken_at",
    )
    .eq("weekly_schedule_config_id", configRecord.weekly_schedule_config_id)
    .eq("scheduled_for_date", normalizedPayload.scheduled_for_date)
    .eq("slot_key", normalizedPayload.slot_key)
    .maybeSingle();

  if (existingLogError) {
    throw new Error("No se pudo guardar la adherencia del calendario.");
  }

  const query = existingLog
    ? supabase
        .from("weekly_schedule_logs")
        .update(writePayload)
        .eq("weekly_schedule_log_id", existingLog.weekly_schedule_log_id)
    : supabase.from("weekly_schedule_logs").insert(writePayload);

  const { data: savedLog, error: saveError } = await query
    .select(
      "weekly_schedule_log_id, weekly_schedule_config_id, patient_medication_id, scheduled_for_date, slot_key, scheduled_time, status, recorded_by_role, recorded_by_auth_user_id, note, logged_at, taken_at",
    )
    .single();

  if (saveError || !savedLog) {
    throw new Error("No se pudo guardar la adherencia del calendario.");
  }

  return {
    log: mapLogSummary(savedLog as WeeklyScheduleLogRecord),
  };
}
