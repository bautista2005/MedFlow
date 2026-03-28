import type { WeeklyScheduleConfigSummary } from "@/lib/calendar/types";

export type PatientAccountStatus = "invited" | "active" | "disabled";
export type PrescriptionRequestStatus =
  | "pending"
  | "reviewed"
  | "accepted"
  | "rejected"
  | "cancelled";
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
  current_file: PrescriptionFileSummary | null;
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
};

export type CreatePatientRequestPayload = {
  patient_medication_id: number;
  patient_note?: string;
};
