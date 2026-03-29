import type { PrescriptionRequestStatus } from "@/lib/patient/types";
import type { WeeklyScheduleConfigSummary, WeeklyScheduleInput } from "@/lib/calendar/types";

export type PharmacySummary = {
  pharmacy_id: number;
  name: string;
  zone: string | null;
  city: string | null;
};

export type PatientSummary = {
  patient_id: number;
  name: string;
  dni: string;
  email: string;
  phone: string | null;
  zone: string | null;
  account_status: "invited" | "active" | "disabled";
  is_primary: boolean;
  preferred_pharmacy: PharmacySummary | null;
  risk_status: "normal" | "warning" | "critical" | null;
  risk_score: number | null;
  last_alert_at: string | null;
  follow_up_notification_count: number;
};

export type PatientRiskIndicator = {
  risk_status: "normal" | "warning" | "critical" | null;
  risk_score: number | null;
  last_alert_at: string | null;
};

export type PatientMedicationSummary = {
  patient_medication_id: number;
  medication_name: string;
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
};

export type PrescriptionFileSummary = {
  prescription_file_id: number;
  original_filename: string;
  mime_type: string;
  uploaded_at: string;
  is_current: boolean;
};

export type PrescriptionRequestSummary = {
  prescription_request_id: number;
  patient_id: number;
  patient_name: string;
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

export type PatientDetail = {
  patient_id: number;
  name: string;
  dni: string;
  email: string;
  phone: string | null;
  address: string | null;
  zone: string | null;
  account_status: "invited" | "active" | "disabled";
  preferred_pharmacy: PharmacySummary | null;
  risk_status: "normal" | "warning" | "critical" | null;
  risk_score: number | null;
  last_alert_at: string | null;
  follow_up_notification_count: number;
  medications: PatientMedicationSummary[];
  requests: PrescriptionRequestSummary[];
  recent_alerts: DoctorPatientAlertSummary[];
};

export type DoctorPatientAlertStatus = "open" | "acknowledged" | "closed";

export type DoctorPatientAlertSeverity = "warning" | "critical";

export type DoctorPatientAlertSummary = {
  doctor_patient_alert_id: number;
  patient_id: number;
  patient_name: string | null;
  active_doctor_id: number;
  patient_chat_log_id: number | null;
  severity: DoctorPatientAlertSeverity;
  title: string;
  message: string;
  status: DoctorPatientAlertStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
};

export type DoctorAlertsResponse = {
  alerts: DoctorPatientAlertSummary[];
};

export type UpdateDoctorAlertStatusPayload = {
  status: DoctorPatientAlertStatus;
};

export type SendDoctorPatientNotificationPayload = {
  message: string;
  type?: "doctor_follow_up_requested";
};

export type CreatePatientMedicationInput = {
  medication_name: string;
  presentation?: string;
  dose_text: string;
  frequency_text: string;
  pills_per_box?: number | null;
  box_count?: number;
  units_per_intake: number;
  intakes_per_day: number;
  start_date: string;
  next_consultation_at?: string | null;
  notes?: string;
};

export type CreatePatientTreatmentPayload = {
  medication_name: string;
  daily_dose: number;
  interval_hours: number;
  pills_per_box: number;
  box_count: number;
  start_date: string;
  weekly_schedule?: WeeklyScheduleInput | null;
};

export type CreatePatientPayload = {
  name: string;
  dni: string;
  email: string;
  phone?: string;
  address?: string;
  zone?: string;
  preferred_pharmacy_id?: number | null;
  password: string;
  medications?: CreatePatientMedicationInput[];
};

export type PatientsIndexResponse = {
  doctor: {
    name: string;
    email: string;
  };
  patients: PatientSummary[];
  pharmacies: PharmacySummary[];
};

export type DoctorRequestsResponse = {
  requests: PrescriptionRequestSummary[];
};

export type UpdateDoctorRequestNotePayload = {
  doctor_note: string;
};

export type UpdateDoctorRequestPharmacyStatusPayload = {
  status: "pharmacy_checking" | "awaiting_alternative_pharmacy" | "ready_for_pickup";
};

export type DoctorProfileResponse = {
  doctor: {
    name: string;
    email: string;
  };
};
