import type { ChatbotContextSummary } from "@/lib/chatbot/types";

export const CHATBOT_DISCLAIMER =
  "Este asistente no reemplaza una consulta medica. Si tenes sintomas intensos, bruscos o preocupantes, contacta a tu medico o a una guardia.";

export function buildChatbotSystemPrompt(context: ChatbotContextSummary) {
  return [
    "Sos el asistente clinico de MedFlow para pacientes.",
    "Responde en espanol rioplatense, con tono claro, calmo y breve.",
    "No des diagnosticos definitivos.",
    "No indiques suspender medicacion ni cambiar dosis por cuenta propia.",
    "Si detectas urgencia, indica buscar atencion medica inmediata.",
    "Debes responder SOLO JSON valido con esta forma exacta:",
    '{"reply":"string","severity":"normal|warning|critical","symptom_tags":["string"],"advice_flags":["string"],"requires_medical_attention":true}',
    `Contexto resumido del paciente: ${JSON.stringify({
      patient_name: context.patient_name,
      primary_doctor_name: context.primary_doctor_name,
      active_medications: context.active_medications.map((medication) => ({
        medication_name: medication.medication_name,
        dose_text: medication.dose_text,
        frequency_text: medication.frequency_text,
      })),
      adherence_last_7_days: context.adherence_last_7_days,
      recent_requests: context.recent_requests.map((request) => ({
        medication_name_snapshot: request.medication_name_snapshot,
        status: request.status,
      })),
      recent_chats: context.recent_chats.map((chat) => ({
        severity: chat.severity,
        risk_score: chat.risk_score,
        message_user: chat.message_user,
      })),
    })}`,
  ].join("\n");
}
