import type {
  ChatbotContextMedication,
  ChatbotContextRecentChat,
  ChatbotContextRequest,
  ChatbotContextSummary,
  PersistedChatbotExchange,
} from "@/lib/chatbot/types";
import { ACTIVE_PRESCRIPTION_REQUEST_STATUSES, type PrescriptionRequestStatus } from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PatientRow = {
  patient_id: number;
  name: string;
};

type DoctorLinkRow = {
  is_primary: boolean;
  active_doctors:
    | {
        active_doctor_id: number;
        name: string;
      }
    | {
        active_doctor_id: number;
        name: string;
      }[]
    | null;
};

type MedicationRow = ChatbotContextMedication;

type RequestRow = ChatbotContextRequest;

type ChatRow = {
  patient_chat_log_id: number;
  message_user: string;
  severity: ChatbotContextRecentChat["severity"];
  risk_score: number;
  created_at: string;
};

type WeeklyScheduleConfigRow = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  days_of_week: number[] | null;
  intake_slots: unknown;
};

type WeeklyScheduleLogRow = {
  weekly_schedule_config_id: number;
  scheduled_for_date: string;
  status: "taken" | "missed" | "taken_late";
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function getIsoDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function countWeeklyScheduledDoses(configs: WeeklyScheduleConfigRow[]) {
  const last7Dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - index);
    return date;
  });

  return configs.reduce((total, config) => {
    const days = config.days_of_week ?? [];
    const slots =
      Array.isArray(config.intake_slots) && config.intake_slots.every((slot) => typeof slot === "object")
        ? config.intake_slots
        : [];

    if (days.length === 0 || slots.length === 0) {
      return total;
    }

    const scheduledForConfig = last7Dates.reduce((count, date) => {
      const weekday = date.getUTCDay();
      return days.includes(weekday) ? count + slots.length : count;
    }, 0);

    return total + scheduledForConfig;
  }, 0);
}

function buildPersistedContextSnapshot(context: ChatbotContextSummary) {
  return {
    patient_name: context.patient_name,
    primary_doctor_name: context.primary_doctor_name,
    active_medications_count: context.active_medications.length,
    active_medication_names: context.active_medications.map((medication) => medication.medication_name),
    recent_requests: {
      total: context.recent_requests.length,
      statuses: context.recent_requests.map((request) => request.status),
    },
    adherence_last_7_days: context.adherence_last_7_days,
  } satisfies PersistedChatbotExchange["context_snapshot"];
}

export async function loadPatientChatbotContext(patientId: number): Promise<ChatbotContextSummary> {
  const supabase = createAdminSupabaseClient();
  const last7Days = getIsoDateDaysAgo(6);

  const [
    { data: patient, error: patientError },
    { data: doctorLinks, error: doctorError },
    { data: medications, error: medicationsError },
    { data: requests, error: requestsError },
    { data: recentChats, error: chatsError },
    { data: scheduleConfigs, error: configsError },
    { data: scheduleLogs, error: logsError },
  ] = await Promise.all([
    supabase.from("patients").select("patient_id, name").eq("patient_id", patientId).maybeSingle(),
    supabase
      .from("patient_doctors")
      .select("is_primary, active_doctors(active_doctor_id, name)")
      .eq("patient_id", patientId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("patient_medications")
      .select("patient_medication_id, medication_name, dose_text, frequency_text, is_active")
      .eq("patient_id", patientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("prescription_requests")
      .select("prescription_request_id, status, requested_at, medication_name_snapshot")
      .eq("patient_id", patientId)
      .order("requested_at", { ascending: false })
      .limit(5),
    supabase
      .from("patient_chat_logs")
      .select("patient_chat_log_id, message_user, severity, risk_score, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("weekly_schedule_configs")
      .select("weekly_schedule_config_id, patient_medication_id, days_of_week, intake_slots")
      .eq("patient_id", patientId)
      .eq("is_enabled", true),
    supabase
      .from("weekly_schedule_logs")
      .select("weekly_schedule_config_id, scheduled_for_date, status")
      .eq("patient_id", patientId)
      .gte("scheduled_for_date", last7Days),
  ]);

  if (
    patientError ||
    doctorError ||
    medicationsError ||
    requestsError ||
    chatsError ||
    configsError ||
    logsError ||
    !patient
  ) {
    throw new Error("No se pudo cargar el contexto del chatbot.");
  }

  const primaryLink = ((doctorLinks ?? []) as DoctorLinkRow[]).find((link) => link.is_primary);
  const primaryDoctor = normalizeRelation(primaryLink?.active_doctors ?? null);

  const scheduled = countWeeklyScheduledDoses((scheduleConfigs ?? []) as WeeklyScheduleConfigRow[]);
  const logSummary = ((scheduleLogs ?? []) as WeeklyScheduleLogRow[]).reduce(
    (summary, log) => {
      if (log.status === "taken") {
        summary.taken += 1;
      } else if (log.status === "taken_late") {
        summary.taken_late += 1;
      } else if (log.status === "missed") {
        summary.missed += 1;
      }

      return summary;
    },
    { taken: 0, taken_late: 0, missed: 0 },
  );
  const completedCount = logSummary.taken + logSummary.taken_late + logSummary.missed;
  const adherenceRatio =
    scheduled > 0 ? (logSummary.taken + logSummary.taken_late * 0.6) / scheduled : null;

  return {
    patient_name: patient.name,
    patient_id: patient.patient_id,
    active_doctor_id: primaryDoctor?.active_doctor_id ?? null,
    primary_doctor_name: primaryDoctor?.name ?? null,
    active_medications: ((medications ?? []) as MedicationRow[]).map((medication) => ({
      patient_medication_id: medication.patient_medication_id,
      medication_name: medication.medication_name,
      dose_text: medication.dose_text,
      frequency_text: medication.frequency_text,
      is_active: medication.is_active,
    })),
    recent_requests: ((requests ?? []) as RequestRow[]).map((request) => ({
      prescription_request_id: request.prescription_request_id,
      status: request.status,
      requested_at: request.requested_at,
      medication_name_snapshot: request.medication_name_snapshot,
    })),
    recent_chats: ((recentChats ?? []) as ChatRow[]).map((chat) => ({
      patient_chat_log_id: chat.patient_chat_log_id,
      message_user: chat.message_user,
      severity: chat.severity,
      risk_score: chat.risk_score,
      created_at: chat.created_at,
    })),
    adherence_last_7_days: {
      scheduled,
      taken: logSummary.taken,
      taken_late: logSummary.taken_late,
      missed: logSummary.missed,
      adherence_ratio:
        completedCount === 0 && scheduled === 0 ? null : adherenceRatio,
    },
  };
}

export function buildPatientChatContextSnapshot(context: ChatbotContextSummary) {
  return buildPersistedContextSnapshot(context);
}

export function getRecentActiveRequestStatuses(requests: ChatbotContextRequest[]) {
  return requests
    .filter((request) => ACTIVE_PRESCRIPTION_REQUEST_STATUSES.includes(request.status))
    .map((request) => request.status) as PrescriptionRequestStatus[];
}
