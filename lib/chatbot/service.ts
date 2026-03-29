import {
  buildEmptyPatientChatContextSnapshot,
  loadPatientChatbotContext,
  loadPatientChatRoutingContext,
} from "@/lib/chatbot/context";
import { createDoctorPatientAlert } from "@/lib/chatbot/alerts";
import { CHATBOT_DISCLAIMER, buildChatbotSystemPrompt } from "@/lib/chatbot/prompt";
import { calculateWeeklyRiskSummary } from "@/lib/chatbot/risk";
import type { ChatbotLlmResult } from "@/lib/chatbot/types";
import { getGeminiEnv } from "@/lib/env";
import type {
  PatientChatLogSummary,
  PatientChatMessageResponse,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_MESSAGE_LENGTH = 1000;

export class PatientChatbotError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PatientChatbotError";
    this.status = status;
  }
}

function normalizeSymptomTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").slice(0, 8);
}

function parseChatbotMessage(message: string) {
  const normalizedMessage = typeof message === "string" ? message.trim().replace(/\s+/g, " ") : "";

  if (!normalizedMessage) {
    throw new PatientChatbotError("Escribe un mensaje para usar el asistente.", 400);
  }

  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new PatientChatbotError("El mensaje es demasiado largo para procesarlo.", 400);
  }

  return normalizedMessage;
}

function buildFallbackLlmResult(): ChatbotLlmResult {
  return {
    reply:
      "Gracias por contarmelo. Puedo orientarte de forma general, pero si el malestar persiste, empeora o te preocupa, consulta a tu medico.",
    severity: "normal",
    symptom_tags: [],
    advice_flags: [],
    requires_medical_attention: false,
  };
}

function severityToRiskScore(severity: ChatbotLlmResult["severity"]) {
  switch (severity) {
    case "critical":
      return 0.9;
    case "warning":
      return 0.55;
    default:
      return 0.1;
  }
}

function normalizeSeverityValue(value: unknown): ChatbotLlmResult["severity"] {
  if (typeof value !== "string") {
    return "normal";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "warning" || normalizedValue === "critical") {
    return normalizedValue;
  }

  return "normal";
}

function parseJsonObject(rawText: string) {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return null;
  }

  try {
    return JSON.parse(trimmedText) as unknown;
  } catch {
    const match = trimmedText.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return null;
    }
  }
}

function normalizeLlmResult(value: unknown): ChatbotLlmResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const reply = typeof candidate.reply === "string" ? candidate.reply.trim() : "";

  if (!reply) {
    return null;
  }

  return {
    reply,
    severity: normalizeSeverityValue(candidate.severity),
    symptom_tags: normalizeSymptomTags(candidate.symptom_tags),
    advice_flags: normalizeSymptomTags(candidate.advice_flags),
    requires_medical_attention: candidate.requires_medical_attention === true,
  };
}

async function callGemini(message: string) {
  const gemini = getGeminiEnv();

  if (!gemini.apiKey) {
    return {
      result: buildFallbackLlmResult(),
      provider: "fallback",
      model: "local-rules",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${gemini.model}:generateContent?key=${gemini.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
          systemInstruction: {
            parts: [{ text: buildChatbotSystemPrompt() }],
          },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("Gemini request failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorText.slice(0, 500),
      });

      return {
        result: buildFallbackLlmResult(),
        provider: "fallback",
        model: "local-rules",
      };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = normalizeLlmResult(parseJsonObject(rawText));

    if (!parsed) {
      console.error("Gemini response could not be parsed", {
        rawText: rawText.slice(0, 500),
      });

      return {
        result: buildFallbackLlmResult(),
        provider: "fallback",
        model: "local-rules",
      };
    }

    return {
      result: parsed,
      provider: "gemini",
      model: gemini.model,
    };
  } catch (error) {
    console.error("Gemini request threw", error);

    return {
      result: buildFallbackLlmResult(),
      provider: "fallback",
      model: "local-rules",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function processPatientChatMessage(input: {
  patientId: number;
  message: string;
}): Promise<PatientChatMessageResponse> {
  const message = parseChatbotMessage(input.message);
  const routingContext = await loadPatientChatRoutingContext(input.patientId);
  const llm = await callGemini(message);
  const llmResult = llm.result;
  const riskScore = severityToRiskScore(llmResult.severity);
  const supabase = createAdminSupabaseClient();

  const { data: persistedMessage, error: persistError } = await supabase
    .from("patient_chat_logs")
    .insert({
      patient_id: input.patientId,
      active_doctor_id: routingContext.active_doctor_id,
      patient_medication_id: null,
      message_user: message,
      message_ai: llmResult.reply,
      severity: llmResult.severity,
      risk_score: riskScore,
      symptom_tags: llmResult.symptom_tags,
      context_snapshot: buildEmptyPatientChatContextSnapshot({
        patientName: routingContext.patient_name,
        primaryDoctorName: routingContext.primary_doctor_name,
      }),
      llm_provider: llm.provider,
      llm_model: llm.model,
    })
    .select(
      "patient_chat_log_id, patient_id, active_doctor_id, patient_medication_id, message_user, message_ai, severity, risk_score, symptom_tags, context_snapshot, created_at",
    )
    .maybeSingle();

  if (persistError || !persistedMessage) {
    throw new Error("No se pudo guardar el mensaje del asistente.");
  }

  const messageSummary: PatientChatLogSummary = {
    patient_chat_log_id: persistedMessage.patient_chat_log_id,
    patient_id: input.patientId,
    active_doctor_id: persistedMessage.active_doctor_id,
    patient_medication_id: persistedMessage.patient_medication_id,
    message_user: message,
    message_ai: llmResult.reply,
    severity: llmResult.severity,
    risk_score: riskScore,
    symptom_tags: llmResult.symptom_tags,
    context_snapshot: persistedMessage.context_snapshot,
    created_at: persistedMessage.created_at,
  };

  let createdAlert = false;

  if (
    routingContext.active_doctor_id &&
    (llmResult.severity === "warning" || llmResult.severity === "critical")
  ) {
    const alert = await createDoctorPatientAlert({
      patientId: input.patientId,
      activeDoctorId: routingContext.active_doctor_id,
      patientChatLogId: persistedMessage.patient_chat_log_id,
      severity: llmResult.severity,
      title:
        llmResult.severity === "critical"
          ? "Paciente requiere atencion prioritaria"
          : "Paciente en seguimiento por sintomas",
      message:
        llmResult.severity === "critical"
          ? `Gemini detecto una consulta sensible de ${routingContext.patient_name}.`
          : `Gemini registro un mensaje que conviene seguir de cerca para ${routingContext.patient_name}.`,
      metadata: {
        message_user: message,
        symptom_tags: llmResult.symptom_tags,
        llm_severity: llmResult.severity,
        requires_medical_attention: llmResult.requires_medical_attention,
      },
    });
    createdAlert = Boolean(alert);
  }

  return {
    reply: llmResult.reply,
    severity: llmResult.severity,
    risk_score: riskScore,
    created_alert: createdAlert,
    disclaimer: CHATBOT_DISCLAIMER,
    message: messageSummary,
  };
}

export async function listPatientChatHistory(input: { patientId: number; limit?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("patient_chat_logs")
    .select(
      "patient_chat_log_id, patient_id, active_doctor_id, patient_medication_id, message_user, message_ai, severity, risk_score, symptom_tags, context_snapshot, created_at",
    )
    .eq("patient_id", input.patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new PatientChatbotError("No se pudo cargar el historial del asistente.", 500);
  }

  return ((data ?? []) as PatientChatLogSummary[]).map((message) => ({
    ...message,
    symptom_tags: Array.isArray(message.symptom_tags)
      ? message.symptom_tags.filter((item): item is string => typeof item === "string")
      : [],
  }));
}

function formatDateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function recalculateWeeklyRiskSnapshots(referenceAt = new Date().toISOString()) {
  const referenceDate = new Date(referenceAt);
  const weekEndDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setUTCDate(weekEndDate.getUTCDate() - 6);
  const weekStart = formatDateToIso(weekStartDate);
  const weekEnd = formatDateToIso(weekEndDate);
  const supabase = createAdminSupabaseClient();

  const [{ data: patients, error: patientsError }, { data: chats, error: chatsError }, { data: logs, error: logsError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabase
        .from("patient_doctors")
        .select("patient_id, active_doctor_id")
        .eq("is_primary", true),
      supabase
        .from("patient_chat_logs")
        .select("patient_id, severity, created_at")
        .gte("created_at", `${weekStart}T00:00:00.000Z`)
        .lte("created_at", `${weekEnd}T23:59:59.999Z`),
      supabase
        .from("weekly_schedule_logs")
        .select("patient_id, status, scheduled_for_date")
        .gte("scheduled_for_date", weekStart)
        .lte("scheduled_for_date", weekEnd),
      supabase
        .from("prescription_requests")
        .select("patient_id, status, requested_at")
        .gte("requested_at", `${weekStart}T00:00:00.000Z`)
        .lte("requested_at", `${weekEnd}T23:59:59.999Z`)
        .order("requested_at", { ascending: false }),
    ]);

  if (patientsError || chatsError || logsError || requestsError) {
    throw new Error("No se pudo recalcular el resumen semanal de riesgo.");
  }

  const patientLinks = (patients ?? []) as Array<{ patient_id: number; active_doctor_id: number }>;
  const inserts = await Promise.all(
    patientLinks.map(async (link) => {
      const context = await loadPatientChatbotContext(link.patient_id);
      const weeklyLogs = ((logs ?? []) as Array<{ patient_id: number; status: "taken" | "missed" | "taken_late"; scheduled_for_date: string }>).filter(
        (log) => log.patient_id === link.patient_id,
      );
      const patientChats = ((chats ?? []) as Array<{ patient_id: number; severity: "normal" | "warning" | "critical"; created_at: string }>).filter(
        (chat) => chat.patient_id === link.patient_id,
      );
      const patientRequests = (
        (requests ?? []) as Array<{
          patient_id: number;
          status: PrescriptionRequestStatus;
          requested_at: string;
        }>
      ).filter((request) => request.patient_id === link.patient_id);

      const weeklyRisk = calculateWeeklyRiskSummary({
        chatMessages: patientChats,
        scheduled: context.adherence_last_7_days.scheduled,
        taken: weeklyLogs.filter((log) => log.status === "taken").length,
        takenLate: weeklyLogs.filter((log) => log.status === "taken_late").length,
        missed: weeklyLogs.filter((log) => log.status === "missed").length,
        openRequestCount: patientRequests.filter((request) =>
          ["pending", "reviewed", "prescription_uploaded", "pharmacy_checking", "no_stock_preferred", "awaiting_alternative_pharmacy"].includes(request.status),
        ).length,
        lastRequestStatus: patientRequests[0]?.status ?? null,
      });

      return {
        patient_id: link.patient_id,
        active_doctor_id: link.active_doctor_id,
        week_start: weekStart,
        week_end: weekEnd,
        adherence_score: weeklyRisk.adherence_score,
        symptom_score: weeklyRisk.symptom_score,
        request_score: weeklyRisk.request_score,
        final_risk_score: weeklyRisk.final_risk_score,
        final_status: weeklyRisk.final_status,
        summary: weeklyRisk.summary,
      };
    }),
  );

  const { error: upsertError } = await supabase.from("patient_weekly_risk_snapshots").upsert(inserts, {
    onConflict: "patient_id,week_start",
  });

  if (upsertError) {
    throw new Error("No se pudo guardar el resumen semanal de riesgo.");
  }

  return {
    processed_patients: inserts.length,
    week_start: weekStart,
    week_end: weekEnd,
  };
}
