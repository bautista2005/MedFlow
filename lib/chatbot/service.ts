import { buildPatientChatContextSnapshot, getRecentActiveRequestStatuses, loadPatientChatbotContext } from "@/lib/chatbot/context";
import { createDoctorPatientAlert } from "@/lib/chatbot/alerts";
import { CHATBOT_DISCLAIMER, buildChatbotSystemPrompt } from "@/lib/chatbot/prompt";
import { calculateChatbotRisk, calculateWeeklyRiskSummary, detectLocalSeverityFromMessage } from "@/lib/chatbot/risk";
import type {
  ChatbotContextSummary,
  ChatbotLlmResult,
  PersistedChatbotExchange,
} from "@/lib/chatbot/types";
import { getGeminiEnv } from "@/lib/env";
import type { PatientChatMessageResponse, PrescriptionRequestStatus } from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_MESSAGE_LENGTH = 1000;
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;
const CHAT_RATE_LIMIT_MAX_MESSAGES = 4;

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

async function enforcePatientChatRateLimit(patientId: number) {
  const supabase = createAdminSupabaseClient();
  const windowStart = new Date(Date.now() - CHAT_RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("patient_chat_logs")
    .select("patient_chat_log_id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .gte("created_at", windowStart);

  if (error) {
    throw new Error("No se pudo validar el limite del chatbot.");
  }

  if ((count ?? 0) >= CHAT_RATE_LIMIT_MAX_MESSAGES) {
    throw new PatientChatbotError(
      "Por favor espera un momento antes de enviar otro mensaje.",
      429,
    );
  }
}

function buildFallbackLlmResult(message: string): ChatbotLlmResult {
  const severity = detectLocalSeverityFromMessage(message);
  const requiresMedicalAttention = severity === "critical";
  const reply =
    severity === "critical"
      ? "Lo que describis puede requerir atencion medica pronta. Contacta a tu medico o a una guardia ahora mismo si el malestar es intenso o empeora."
      : severity === "warning"
        ? "Entiendo lo que comentas. Conviene que sigas registrando los sintomas y, si persisten o empeoran, avises a tu medico para seguimiento."
        : "Gracias por contarmelo. Puedo ayudarte a registrar esto y orientarte, pero si notas cambios importantes debes consultar a tu medico.";

  return {
    reply,
    severity,
    symptom_tags: [],
    advice_flags: requiresMedicalAttention ? ["seek_medical_attention"] : [],
    requires_medical_attention: requiresMedicalAttention,
  };
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
    severity:
      candidate.severity === "warning" || candidate.severity === "critical"
        ? candidate.severity
        : "normal",
    symptom_tags: normalizeSymptomTags(candidate.symptom_tags),
    advice_flags: normalizeSymptomTags(candidate.advice_flags),
    requires_medical_attention: candidate.requires_medical_attention === true,
  };
}

async function callGemini(message: string, context: ChatbotContextSummary) {
  const gemini = getGeminiEnv();

  if (!gemini.apiKey) {
    return {
      result: buildFallbackLlmResult(message),
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
            parts: [{ text: buildChatbotSystemPrompt(context) }],
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
      return {
        result: buildFallbackLlmResult(message),
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
    const parsed = normalizeLlmResult(rawText ? JSON.parse(rawText) : null);

    if (!parsed) {
      return {
        result: buildFallbackLlmResult(message),
        provider: "fallback",
        model: "local-rules",
      };
    }

    return {
      result: parsed,
      provider: "gemini",
      model: gemini.model,
    };
  } catch {
    return {
      result: buildFallbackLlmResult(message),
      provider: "fallback",
      model: "local-rules",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mapPersistedChatLog(row: {
  patient_chat_log_id: number;
  patient_id: number;
  active_doctor_id: number | null;
  patient_medication_id: number | null;
  message_user: string;
  message_ai: string;
  severity: "normal" | "warning" | "critical";
  risk_score: number;
  symptom_tags: string[] | null;
  context_snapshot: PersistedChatbotExchange["context_snapshot"] | null;
  created_at: string;
}): PersistedChatbotExchange {
  return {
    patient_chat_log_id: row.patient_chat_log_id,
    patient_id: row.patient_id,
    active_doctor_id: row.active_doctor_id,
    patient_medication_id: row.patient_medication_id,
    message_user: row.message_user,
    message_ai: row.message_ai,
    severity: row.severity,
    risk_score: row.risk_score,
    symptom_tags: row.symptom_tags ?? [],
    context_snapshot: row.context_snapshot ?? {
      patient_name: "",
      primary_doctor_name: null,
      active_medications_count: 0,
      active_medication_names: [],
      recent_requests: { total: 0, statuses: [] },
      adherence_last_7_days: {
        scheduled: 0,
        taken: 0,
        taken_late: 0,
        missed: 0,
        adherence_ratio: null,
      },
    },
    created_at: row.created_at,
  };
}

async function persistChatExchange(input: {
  patientId: number;
  activeDoctorId: number | null;
  context: ChatbotContextSummary;
  message: string;
  reply: string;
  severity: "normal" | "warning" | "critical";
  riskScore: number;
  symptomTags: string[];
  provider: string;
  model: string;
}) {
  const supabase = createAdminSupabaseClient();
  const primaryMedicationId = input.context.active_medications[0]?.patient_medication_id ?? null;
  const { data, error } = await supabase
    .from("patient_chat_logs")
    .insert({
      patient_id: input.patientId,
      active_doctor_id: input.activeDoctorId,
      patient_medication_id: primaryMedicationId,
      message_user: input.message,
      message_ai: input.reply,
      severity: input.severity,
      risk_score: input.riskScore,
      symptom_tags: input.symptomTags,
      context_snapshot: buildPatientChatContextSnapshot(input.context),
      llm_provider: input.provider,
      llm_model: input.model,
    })
    .select(
      "patient_chat_log_id, patient_id, active_doctor_id, patient_medication_id, message_user, message_ai, severity, risk_score, symptom_tags, context_snapshot, created_at",
    )
    .single();

  if (error || !data) {
    throw new Error("No se pudo guardar el historial del chatbot.");
  }

  return mapPersistedChatLog(
    data as {
      patient_chat_log_id: number;
      patient_id: number;
      active_doctor_id: number | null;
      patient_medication_id: number | null;
      message_user: string;
      message_ai: string;
      severity: "normal" | "warning" | "critical";
      risk_score: number;
      symptom_tags: string[] | null;
      context_snapshot: PersistedChatbotExchange["context_snapshot"] | null;
      created_at: string;
    },
  );
}

export async function processPatientChatMessage(input: {
  patientId: number;
  message: string;
}): Promise<PatientChatMessageResponse> {
  const message = parseChatbotMessage(input.message);
  await enforcePatientChatRateLimit(input.patientId);
  const context = await loadPatientChatbotContext(input.patientId);
  const llm = await callGemini(message, context);
  const risk = calculateChatbotRisk({
    llmResult: llm.result,
    context,
    message,
  });
  const persistedMessage = await persistChatExchange({
    patientId: input.patientId,
    activeDoctorId: context.active_doctor_id,
    context,
    message,
    reply: llm.result.reply,
    severity: risk.final_severity,
    riskScore: risk.final_risk_score,
    symptomTags: llm.result.symptom_tags,
    provider: llm.provider,
    model: llm.model,
  });

  let createdAlert = false;

  if (context.active_doctor_id && (risk.final_severity === "warning" || risk.final_severity === "critical")) {
    const alert = await createDoctorPatientAlert({
      patientId: input.patientId,
      activeDoctorId: context.active_doctor_id,
      patientChatLogId: persistedMessage.patient_chat_log_id,
      severity: risk.final_severity,
      title:
        risk.final_severity === "critical"
          ? "Paciente requiere atencion prioritaria"
          : "Paciente en seguimiento por sintomas",
      message:
        risk.final_severity === "critical"
          ? `El asistente detecto una consulta sensible de ${context.patient_name}.`
          : `El asistente registro un mensaje que conviene seguir de cerca para ${context.patient_name}.`,
      metadata: {
        symptom_tags: llm.result.symptom_tags,
        active_request_statuses: getRecentActiveRequestStatuses(context.recent_requests),
        override_reasons: risk.override_reasons,
      },
    });
    createdAlert = Boolean(alert);
  }

  return {
    reply: llm.result.reply,
    severity: risk.final_severity,
    risk_score: risk.final_risk_score,
    created_alert: createdAlert,
    disclaimer: CHATBOT_DISCLAIMER,
    message: persistedMessage,
  };
}

export async function listPatientChatHistory(input: { patientId: number; limit?: number }) {
  const limit = typeof input.limit === "number" ? Math.min(Math.max(input.limit, 1), 20) : 20;
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
    throw new Error("No se pudo cargar el historial del chatbot.");
  }

  return (data ?? []).map((row) =>
    mapPersistedChatLog(
      row as {
        patient_chat_log_id: number;
        patient_id: number;
        active_doctor_id: number | null;
        patient_medication_id: number | null;
        message_user: string;
        message_ai: string;
        severity: "normal" | "warning" | "critical";
        risk_score: number;
        symptom_tags: string[] | null;
        context_snapshot: PersistedChatbotExchange["context_snapshot"] | null;
        created_at: string;
      },
    ),
  );
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
