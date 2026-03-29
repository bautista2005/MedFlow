import type { WeeklyScheduleConfigSummary } from "@/lib/calendar/types";

export type PatientAccountStatus = "invited" | "active" | "disabled";
export type PrescriptionRequestStatus =
  | "pending"
  | "reviewed"
  | "prescription_uploaded"
  | "pharmacy_checking"
  | "no_stock_preferred"
  | "awaiting_alternative_pharmacy"
  | "ready_for_pickup"
  | "cancelled";
export const ACTIVE_PRESCRIPTION_REQUEST_STATUSES: PrescriptionRequestStatus[] = [
  "pending",
  "reviewed",
  "prescription_uploaded",
  "pharmacy_checking",
  "no_stock_preferred",
  "awaiting_alternative_pharmacy",
];
export type PatientNotificationCategory =
  | "calendar"
  | "prescription"
  | "doctor_message"
  | "system";
export type PatientNotificationType =
  | "calendar_dose_reminder"
  | "calendar_missed_dose"
  | "prescription_request_created"
  | "prescription_request_waiting_doctor"
  | "prescription_file_uploaded"
  | "prescription_request_pharmacy_checking"
  | "prescription_request_no_stock_preferred"
  | "prescription_request_choose_alternative_pharmacy"
  | "prescription_request_ready_for_pickup"
  | "doctor_observation_created"
  | "doctor_follow_up_requested"
  | "doctor_chatbot_alert_acknowledged"
  | "chatbot_warning_logged"
  | "chatbot_critical_alert_sent"
  | "medication_running_low"
  | "follow_up_reminder";
export type PatientNotificationStatus = "unread" | "read";
export type PatientNotificationPriority = "low" | "normal" | "high";
export type PatientNotificationSource = "system" | "doctor" | "pharmacy" | "calendar";
export type PatientNotificationStatusFilter = PatientNotificationStatus | "all";
export type MedicationStatusTone = "success" | "warning" | "danger" | "neutral";
export type MedicationBlockedReason =
  | "missing_data"
  | "too_early"
  | "request_in_progress";

export type PharmacySummary = {
  pharmacy_id: number;
  name: string;
  zone: string | null;
  city: string | null;
};

export type DoctorSummary = {
  active_doctor_id: number;
  name: string;
  email: string;
  organization: string;
};

export type DoctorMessageNotificationKind = "observation" | "follow_up" | "chatbot_acknowledged";

export type DoctorMessageNotificationMetadata = {
  doctor_id: number;
  patient_id: number;
  related_prescription_id?: number;
  related_treatment_id?: number;
  message_kind: DoctorMessageNotificationKind;
  observation: string;
  medication_name?: string;
};

export type PatientChatSeverity = "normal" | "warning" | "critical";

export type PatientChatContextSummary = {
  patient_name: string;
  primary_doctor_name: string | null;
  active_medications_count: number;
  active_medication_names: string[];
  recent_requests: {
    total: number;
    statuses: PrescriptionRequestStatus[];
  };
  adherence_last_7_days: {
    scheduled: number;
    taken: number;
    taken_late: number;
    missed: number;
    adherence_ratio: number | null;
  };
};

export type PatientChatLogSummary = {
  patient_chat_log_id: number;
  patient_id: number;
  active_doctor_id: number | null;
  patient_medication_id: number | null;
  message_user: string;
  message_ai: string;
  severity: PatientChatSeverity;
  risk_score: number;
  symptom_tags: string[];
  context_snapshot: PatientChatContextSummary;
  created_at: string;
};

export type PatientChatHistoryResponse = {
  messages: PatientChatLogSummary[];
};

export type PatientChatMessagePayload = {
  message: string;
};

export type PatientChatMessageResponse = {
  reply: string;
  severity: PatientChatSeverity;
  risk_score: number;
  created_alert: boolean;
  disclaimer: string;
  message: PatientChatLogSummary;
};

export type PrescriptionFileSummary = {
  prescription_file_id: number;
  original_filename: string;
  mime_type: string;
  uploaded_at: string;
  is_current: boolean;
};

export type PatientProfile = {
  patient_id: number;
  name: string;
  email: string;
  phone: string | null;
  zone: string | null;
  account_status: PatientAccountStatus;
  preferred_pharmacy: PharmacySummary | null;
};

export type PatientRequestSummary = {
  prescription_request_id: number;
  patient_medication_id: number;
  medication_name: string;
  status: PrescriptionRequestStatus;
  requested_at: string;
  resolved_at: string | null;
  patient_note: string | null;
  doctor_note: string | null;
  preferred_pharmacy: PharmacySummary | null;
  assigned_pharmacy: PharmacySummary | null;
  current_file: PrescriptionFileSummary | null;
};

export type PrescriptionProgressStepLabel =
  | "Solicitud enviada"
  | "Receta validada"
  | "Pedido aprobado"
  | "Farmacia asignada"
  | "Listo para retirar";

export type PrescriptionProgressSummary = {
  title: string;
  medicationName: string;
  currentStep: number;
  totalSteps: number;
  steps: PrescriptionProgressStepLabel[];
  progressPercentage: number;
  dismissible: boolean;
  currentStepLabel: string;
  helperText: string | null;
  currentStatus: PrescriptionRequestStatus;
};

export type PatientNotificationSummary = {
  patient_notification_id: number;
  patient_id: number;
  active_doctor_id: number | null;
  patient_medication_id: number | null;
  prescription_request_id: number | null;
  weekly_schedule_config_id: number | null;
  source: PatientNotificationSource;
  category: PatientNotificationCategory;
  type: PatientNotificationType;
  title: string;
  message: string;
  status: PatientNotificationStatus;
  priority: PatientNotificationPriority;
  action_url: string | null;
  metadata: Record<string, unknown>;
  scheduled_for: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  prescription_progress?: PrescriptionProgressSummary | null;
};

export type PatientNotificationListResponse = {
  notifications: PatientNotificationSummary[];
  unread_count: number;
};

export type MedicationCalculation = {
  can_calculate: boolean;
  daily_units: number | null;
  total_units: number | null;
  estimated_duration_days: number | null;
  elapsed_days: number | null;
  remaining_days: number | null;
  remaining_percentage: number | null;
  status_tone: MedicationStatusTone;
  can_request_refill: boolean;
  blocked_reason: MedicationBlockedReason | null;
  blocked_message: string | null;
};

export type PatientMedicationSummary = {
  patient_medication_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  frequency_text: string;
  pills_per_box: number | null;
  box_count: number;
  units_per_intake: number | null;
  intakes_per_day: number | null;
  start_date: string;
  next_consultation_at: string | null;
  notes: string | null;
  is_active: boolean;
  weekly_schedule: WeeklyScheduleConfigSummary | null;
  doctor: DoctorSummary;
  latest_request: PatientRequestSummary | null;
  calculation: MedicationCalculation;
};

export type PatientDashboardResponse = {
  patient: PatientProfile;
  medications: PatientMedicationSummary[];
  requests: PatientRequestSummary[];
  pharmacies: PharmacySummary[];
};

export type CreatePatientRequestPayload = {
  patient_medication_id: number;
  patient_note?: string;
};

export type UpdatePatientAlternativePharmacyPayload = {
  pharmacy_id: number;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function getDoctorMessageNotificationMetadata(
  metadata: Record<string, unknown>,
): DoctorMessageNotificationMetadata | null {
  const doctorId = metadata.doctor_id;
  const patientId = metadata.patient_id;
  const messageKind = metadata.message_kind;
  const observation = metadata.observation;

  if (
    !isPositiveInteger(doctorId) ||
    !isPositiveInteger(patientId) ||
    (messageKind !== "observation" &&
      messageKind !== "follow_up" &&
      messageKind !== "chatbot_acknowledged") ||
    typeof observation !== "string" ||
    observation.trim().length === 0
  ) {
    return null;
  }

  const relatedPrescriptionId = metadata.related_prescription_id;
  const relatedTreatmentId = metadata.related_treatment_id;
  const medicationName = metadata.medication_name;

  return {
    doctor_id: doctorId,
    patient_id: patientId,
    ...(isPositiveInteger(relatedPrescriptionId)
      ? { related_prescription_id: relatedPrescriptionId }
      : {}),
    ...(isPositiveInteger(relatedTreatmentId) ? { related_treatment_id: relatedTreatmentId } : {}),
    message_kind: messageKind,
    observation,
    ...(typeof medicationName === "string" && medicationName.trim().length > 0
      ? { medication_name: medicationName }
      : {}),
  };
}
