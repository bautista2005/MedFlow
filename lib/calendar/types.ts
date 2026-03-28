export type WeeklyScheduleSlotInput = {
  slot_key: string;
  label?: string | null;
  time?: string | null;
};

export type WeeklyScheduleInput = {
  is_enabled?: boolean;
  schedule_start_date?: string;
  schedule_end_date?: string | null;
  days_of_week: number[];
  intake_slots: WeeklyScheduleSlotInput[];
  notes?: string | null;
};

export type WeeklyScheduleSlot = {
  slot_key: string;
  label: string | null;
  time: string | null;
};

export type WeeklyScheduleConfigSummary = {
  weekly_schedule_config_id: number;
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[];
  intake_slots: WeeklyScheduleSlot[];
  notes: string | null;
};

export type WeeklyScheduleLogStatus = "taken" | "missed" | "taken_late";

export type WeeklyScheduleLogSummary = {
  weekly_schedule_log_id: number;
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  scheduled_time: string | null;
  status: WeeklyScheduleLogStatus;
  recorded_by_role: "patient" | "doctor" | "system";
  recorded_by_auth_user_id: string | null;
  note: string | null;
  logged_at: string;
  taken_at: string | null;
};

export type WeeklyCalendarDoseStatus = "pending" | "taken" | "taken_late" | "missed";

export type PatientWeeklyCalendarDose = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  units_per_intake: number | null;
  frequency_text: string;
  slot_key: string;
  slot_label: string | null;
  slot_time: string | null;
  scheduled_for_date: string;
  status: WeeklyCalendarDoseStatus;
  log_id: number | null;
  logged_at: string | null;
  taken_at: string | null;
  note: string | null;
};

export type PatientWeeklyCalendarDay = {
  date: string;
  weekday: number;
  label: string;
  is_today: boolean;
  doses: PatientWeeklyCalendarDose[];
};

export type PatientWeeklyCalendarResponse = {
  week_start: string;
  week_end: string;
  has_calendar: boolean;
  days: PatientWeeklyCalendarDay[];
};

export type WeeklyCalendarStatusSummary = {
  scheduled: number;
  taken: number;
  taken_late: number;
  missed: number;
  pending: number;
};

export type DoctorWeeklyCalendarMedication = {
  patient_medication_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  frequency_text: string;
  units_per_intake: number | null;
  start_date: string;
  schedule: WeeklyScheduleConfigSummary;
  summary: WeeklyCalendarStatusSummary;
  days: PatientWeeklyCalendarDay[];
};

export type DoctorWeeklyCalendarResponse = {
  week_start: string;
  week_end: string;
  has_treatments: boolean;
  has_schedule: boolean;
  has_calendar: boolean;
  summary: WeeklyCalendarStatusSummary;
  medications: DoctorWeeklyCalendarMedication[];
};

export type PatientCalendarLogStatus = WeeklyScheduleLogStatus;

export type UpsertPatientCalendarLogPayload = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  status: PatientCalendarLogStatus;
};

export type UpsertPatientCalendarLogResponse = {
  log: WeeklyScheduleLogSummary;
};
