import type {
  ChatbotContextSummary,
  ChatbotLlmResult,
  ChatbotRiskBreakdown,
  ChatbotSeverity,
  ChatbotWeeklyRiskSnapshotSummary,
} from "@/lib/chatbot/types";
import { ACTIVE_PRESCRIPTION_REQUEST_STATUSES, type PrescriptionRequestStatus } from "@/lib/patient/types";

const CRITICAL_KEYWORDS = [
  "pecho",
  "respirar",
  "falta de aire",
  "no puedo respirar",
  "desmayo",
  "convulsion",
  "fractura",
  "fracture",
  "quebre",
  "quebrado",
  "quebrada",
  "hueso",
  "brazo roto",
  "pierna rota",
  "sangrado",
  "alergia",
  "hinchazon",
  "hinchazon severa",
  "reaccion alergica",
];

const WARNING_KEYWORDS = [
  "mareo",
  "dolor",
  "fiebre",
  "nausea",
  "vomito",
  "debilidad",
  "me cayo mal",
  "me hizo mal",
  "malestar",
  "rash",
  "ronchas",
  "diarrea",
];

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function severityToSymptomScore(severity: ChatbotSeverity) {
  switch (severity) {
    case "critical":
      return 0.9;
    case "warning":
      return 0.5;
    default:
      return 0.1;
  }
}

function getAdherenceScore(context: ChatbotContextSummary) {
  const ratio = context.adherence_last_7_days.adherence_ratio;

  if (ratio === null) {
    return 0.15;
  }

  return clampScore(1 - ratio);
}

function getRequestScore(context: ChatbotContextSummary) {
  const activeRequests = context.recent_requests.filter((request) =>
    ACTIVE_PRESCRIPTION_REQUEST_STATUSES.includes(request.status),
  );
  const hasPharmacyFriction = activeRequests.some(
    (request) =>
      request.status === "no_stock_preferred" ||
      request.status === "awaiting_alternative_pharmacy" ||
      request.status === "pharmacy_checking",
  );

  if (hasPharmacyFriction) {
    return 0.75;
  }

  if (activeRequests.length > 0) {
    return 0.4;
  }

  return 0.05;
}

function normalizeSeverity(value: string | null | undefined): ChatbotSeverity {
  if (value === "warning" || value === "critical") {
    return value;
  }

  return "normal";
}

export function detectLocalSeverityFromMessage(message: string): ChatbotSeverity {
  const normalizedMessage = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (CRITICAL_KEYWORDS.some((keyword) => normalizedMessage.includes(keyword))) {
    return "critical";
  }

  if (WARNING_KEYWORDS.some((keyword) => normalizedMessage.includes(keyword))) {
    return "warning";
  }

  return "normal";
}

export function calculateChatbotRisk(input: {
  llmResult: ChatbotLlmResult;
  context: ChatbotContextSummary;
  message: string;
}): ChatbotRiskBreakdown {
  const llmSeverity = normalizeSeverity(input.llmResult.severity);
  const localMessageSeverity = detectLocalSeverityFromMessage(input.message);
  const recentCriticalCount = input.context.recent_chats.filter(
    (chat) => chat.severity === "critical",
  ).length;
  const recentWarningCount = input.context.recent_chats.filter(
    (chat) => chat.severity === "warning",
  ).length;

  let symptomScore = Math.max(
    severityToSymptomScore(llmSeverity),
    severityToSymptomScore(localMessageSeverity),
  );

  if (recentWarningCount >= 2) {
    symptomScore = Math.max(symptomScore, 0.65);
  }

  const adherenceScore = getAdherenceScore(input.context);
  const requestScore = getRequestScore(input.context);

  let finalRiskScore = clampScore(
    0.5 * symptomScore + 0.35 * adherenceScore + 0.15 * requestScore,
  );
  let finalSeverity: ChatbotSeverity =
    finalRiskScore >= 0.6 ? "critical" : finalRiskScore >= 0.3 ? "warning" : "normal";
  const overrideReasons: string[] = [];

  if (input.llmResult.requires_medical_attention) {
    finalSeverity = "critical";
    finalRiskScore = Math.max(finalRiskScore, 0.85);
    overrideReasons.push("llm_requires_medical_attention");
  }

  if (localMessageSeverity === "critical") {
    finalSeverity = "critical";
    finalRiskScore = Math.max(finalRiskScore, 0.9);
    overrideReasons.push("critical_symptom_keyword");
  }

  if (recentCriticalCount >= 1 && llmSeverity !== "normal") {
    finalSeverity = "critical";
    finalRiskScore = Math.max(finalRiskScore, 0.82);
    overrideReasons.push("recent_critical_events");
  }

  return {
    symptom_score: clampScore(symptomScore),
    adherence_score: clampScore(adherenceScore),
    request_score: clampScore(requestScore),
    final_risk_score: clampScore(finalRiskScore),
    final_severity: finalSeverity,
    override_reasons: overrideReasons,
  };
}

export function calculateWeeklyRiskSummary(input: {
  chatMessages: Array<{ severity: ChatbotSeverity }>;
  scheduled: number;
  taken: number;
  takenLate: number;
  missed: number;
  openRequestCount: number;
  lastRequestStatus: PrescriptionRequestStatus | null;
}) {
  const symptomScore = input.chatMessages.some((message) => message.severity === "critical")
    ? 0.9
    : input.chatMessages.some((message) => message.severity === "warning")
      ? 0.5
      : input.chatMessages.length > 0
        ? 0.1
        : 0.05;
  const adherenceRatio =
    input.scheduled > 0 ? (input.taken + input.takenLate * 0.6) / input.scheduled : null;
  const adherenceScore = adherenceRatio === null ? 0.15 : clampScore(1 - adherenceRatio);
  const requestScore =
    input.lastRequestStatus === "no_stock_preferred" ||
    input.lastRequestStatus === "awaiting_alternative_pharmacy"
      ? 0.75
      : input.openRequestCount > 0
        ? 0.4
        : 0.05;
  let finalRiskScore = clampScore(0.5 * symptomScore + 0.35 * adherenceScore + 0.15 * requestScore);
  let finalStatus: ChatbotSeverity =
    finalRiskScore >= 0.6 ? "critical" : finalRiskScore >= 0.3 ? "warning" : "normal";

  if (input.chatMessages.filter((message) => message.severity === "critical").length >= 2) {
    finalStatus = "critical";
    finalRiskScore = Math.max(finalRiskScore, 0.82);
  }

  return {
    adherence_score: adherenceScore,
    symptom_score: symptomScore,
    request_score: requestScore,
    final_risk_score: finalRiskScore,
    final_status: finalStatus,
    summary: {
      chat: {
        total_messages: input.chatMessages.length,
        warnings: input.chatMessages.filter((message) => message.severity === "warning").length,
        criticals: input.chatMessages.filter((message) => message.severity === "critical").length,
      },
      adherence: {
        scheduled: input.scheduled,
        taken: input.taken,
        taken_late: input.takenLate,
        missed: input.missed,
      },
      requests: {
        open_requests: input.openRequestCount,
        last_status: input.lastRequestStatus,
      },
    } satisfies ChatbotWeeklyRiskSnapshotSummary,
  };
}
