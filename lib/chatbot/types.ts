import type { PrescriptionRequestStatus } from "@/lib/patient/types";

export type ChatbotSeverity = "normal" | "warning" | "critical";

export type ChatbotWeeklyStatus = ChatbotSeverity;

export type PatientChatbotMessagePayload = {
  message: string;
};

export type ChatbotLlmResult = {
  reply: string;
  severity: ChatbotSeverity;
  symptom_tags: string[];
  advice_flags: string[];
  requires_medical_attention: boolean;
};

export type ChatbotRiskBreakdown = {
  symptom_score: number;
  adherence_score: number;
  request_score: number;
  final_risk_score: number;
  final_severity: ChatbotSeverity;
  override_reasons: string[];
};

export type ChatbotContextMedication = {
  patient_medication_id: number;
  medication_name: string;
  dose_text: string;
  frequency_text: string;
  is_active: boolean;
};

export type ChatbotContextRequest = {
  prescription_request_id: number;
  status: PrescriptionRequestStatus;
  requested_at: string;
  medication_name_snapshot: string;
};

export type ChatbotContextRecentChat = {
  patient_chat_log_id: number;
  message_user: string;
  severity: ChatbotSeverity;
  risk_score: number;
  created_at: string;
};

export type ChatbotContextSummary = {
  patient_name: string;
  patient_id: number;
  active_doctor_id: number | null;
  primary_doctor_name: string | null;
  active_medications: ChatbotContextMedication[];
  recent_requests: ChatbotContextRequest[];
  recent_chats: ChatbotContextRecentChat[];
  adherence_last_7_days: {
    scheduled: number;
    taken: number;
    taken_late: number;
    missed: number;
    adherence_ratio: number | null;
  };
};

export type PersistedChatbotExchange = {
  patient_chat_log_id: number;
  patient_id: number;
  active_doctor_id: number | null;
  patient_medication_id: number | null;
  message_user: string;
  message_ai: string;
  severity: ChatbotSeverity;
  risk_score: number;
  symptom_tags: string[];
  context_snapshot: {
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
  created_at: string;
};

export type ChatbotWeeklyRiskSnapshotSummary = {
  chat: {
    total_messages: number;
    warnings: number;
    criticals: number;
  };
  adherence: {
    scheduled: number;
    taken: number;
    taken_late: number;
    missed: number;
  };
  requests: {
    open_requests: number;
    last_status: PrescriptionRequestStatus | null;
  };
};
