import type { DoctorPatientAlertSummary, PatientRiskIndicator } from "@/lib/doctor/types";
import { createDoctorChatbotAcknowledgementNotification, createPatientNotification } from "@/lib/patient/notifications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DoctorAlertRow = {
  doctor_patient_alert_id: number;
  patient_id: number;
  active_doctor_id: number;
  patient_chat_log_id: number | null;
  severity: "warning" | "critical";
  title: string;
  message: string;
  status: "open" | "acknowledged" | "closed";
  metadata: Record<string, unknown> | null;
  created_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
  patients:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

type WeeklyRiskSnapshotRow = {
  patient_id: number;
  final_status: "normal" | "warning" | "critical";
  final_risk_score: number;
  created_at: string;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapDoctorAlert(row: DoctorAlertRow): DoctorPatientAlertSummary {
  return {
    doctor_patient_alert_id: row.doctor_patient_alert_id,
    patient_id: row.patient_id,
    patient_name: normalizeRelation(row.patients)?.name ?? null,
    active_doctor_id: row.active_doctor_id,
    patient_chat_log_id: row.patient_chat_log_id,
    severity: row.severity,
    title: row.title,
    message: row.message,
    status: row.status,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    acknowledged_at: row.acknowledged_at,
    closed_at: row.closed_at,
  };
}

export async function createDoctorPatientAlert(input: {
  patientId: number;
  activeDoctorId: number;
  patientChatLogId: number;
  severity: "warning" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const dedupeWindowStart = new Date(Date.now() - 15 * 60_000).toISOString();
  const normalizedMessage = input.message.trim().toLowerCase();

  const { data: existingAlert, error: existingAlertError } = await supabase
    .from("doctor_patient_alerts")
    .select("doctor_patient_alert_id")
    .eq("patient_id", input.patientId)
    .eq("active_doctor_id", input.activeDoctorId)
    .eq("severity", input.severity)
    .eq("status", "open")
    .gte("created_at", dedupeWindowStart)
    .contains("metadata", { normalized_message: normalizedMessage })
    .maybeSingle();

  if (existingAlertError) {
    throw new Error("No se pudo validar la alerta del chatbot.");
  }

  if (existingAlert) {
    return null;
  }

  const { data, error } = await supabase
    .from("doctor_patient_alerts")
    .insert({
      patient_id: input.patientId,
      active_doctor_id: input.activeDoctorId,
      patient_chat_log_id: input.patientChatLogId,
      severity: input.severity,
      title: input.title,
      message: input.message,
      status: "open",
      metadata: {
        ...(input.metadata ?? {}),
        normalized_message: normalizedMessage,
      },
    })
    .select(
      "doctor_patient_alert_id, patient_id, active_doctor_id, patient_chat_log_id, severity, title, message, status, metadata, created_at, acknowledged_at, closed_at, patients(name)",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se pudo registrar la alerta del chatbot.");
  }

  await createPatientNotification({
    patientId: input.patientId,
    activeDoctorId: input.activeDoctorId,
    source: "system",
    category: "system",
    type: input.severity === "critical" ? "chatbot_critical_alert_sent" : "chatbot_warning_logged",
    title: input.severity === "critical" ? "Derivamos tu mensaje al equipo medico" : "Registramos tu consulta para seguimiento",
    message:
      input.severity === "critical"
        ? "Tu mensaje fue marcado para revision prioritaria por el equipo medico."
        : "Tu mensaje quedo registrado y puede requerir seguimiento medico.",
    priority: input.severity === "critical" ? "high" : "normal",
    actionUrl: "/paciente/notificaciones",
    metadata: {
      patient_chat_log_id: input.patientChatLogId,
      severity: input.severity,
    },
    dedupeKey: `chatbot_alert:${input.patientChatLogId}`,
  });

  return mapDoctorAlert(data as DoctorAlertRow);
}

export async function listDoctorAlerts(input: {
  activeDoctorId: number;
  includeClosed?: boolean;
}) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("doctor_patient_alerts")
    .select(
      "doctor_patient_alert_id, patient_id, active_doctor_id, patient_chat_log_id, severity, title, message, status, metadata, created_at, acknowledged_at, closed_at, patients(name)",
    )
    .eq("active_doctor_id", input.activeDoctorId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (!input.includeClosed) {
    query = query.in("status", ["open", "acknowledged"]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("No se pudieron cargar las alertas del medico.");
  }

  return ((data ?? []) as DoctorAlertRow[]).map(mapDoctorAlert);
}

export async function updateDoctorAlertStatus(input: {
  alertId: number;
  activeDoctorId: number;
  status: "acknowledged" | "closed";
}) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("doctor_patient_alerts")
    .update({
      status: input.status,
      acknowledged_at: input.status === "acknowledged" ? now : null,
      closed_at: input.status === "closed" ? now : null,
    })
    .eq("doctor_patient_alert_id", input.alertId)
    .eq("active_doctor_id", input.activeDoctorId)
    .select(
      "doctor_patient_alert_id, patient_id, active_doctor_id, patient_chat_log_id, severity, title, message, status, metadata, created_at, acknowledged_at, closed_at, patients(name)",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se pudo actualizar la alerta.");
  }

  if (input.status === "acknowledged") {
    await createDoctorChatbotAcknowledgementNotification({
      patientId: data.patient_id,
      activeDoctorId: data.active_doctor_id,
      patientChatLogId: data.patient_chat_log_id,
      message: "Tu medico reviso una alerta reciente generada por el asistente.",
    });
  }

  return mapDoctorAlert(data as DoctorAlertRow);
}

export async function getPatientRiskIndicators(patientIds: number[]) {
  if (patientIds.length === 0) {
    return new Map<number, PatientRiskIndicator>();
  }

  const supabase = createAdminSupabaseClient();
  const [{ data: snapshots, error: snapshotsError }, { data: alerts, error: alertsError }] =
    await Promise.all([
      supabase
        .from("patient_weekly_risk_snapshots")
        .select("patient_id, final_status, final_risk_score, created_at")
        .in("patient_id", patientIds)
        .order("week_start", { ascending: false }),
      supabase
        .from("doctor_patient_alerts")
        .select("patient_id, severity, created_at")
        .in("patient_id", patientIds)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false }),
    ]);

  if (snapshotsError || alertsError) {
    throw new Error("No se pudo calcular el riesgo de los pacientes.");
  }

  const snapshotMap = new Map<number, WeeklyRiskSnapshotRow>();
  for (const snapshot of (snapshots ?? []) as WeeklyRiskSnapshotRow[]) {
    if (!snapshotMap.has(snapshot.patient_id)) {
      snapshotMap.set(snapshot.patient_id, snapshot);
    }
  }

  const indicatorMap = new Map<number, PatientRiskIndicator>();

  for (const patientId of patientIds) {
    const snapshot = snapshotMap.get(patientId);
    indicatorMap.set(patientId, {
      risk_status: snapshot?.final_status ?? null,
      risk_score: snapshot?.final_risk_score ?? null,
      last_alert_at: null,
    });
  }

  for (const alert of (alerts ?? []) as Array<{
    patient_id: number;
    severity: "warning" | "critical";
    created_at: string;
  }>) {
    const current = indicatorMap.get(alert.patient_id) ?? {
      risk_status: null,
      risk_score: null,
      last_alert_at: null,
    };

    indicatorMap.set(alert.patient_id, {
      risk_status:
        alert.severity === "critical"
          ? "critical"
          : current.risk_status === "critical"
            ? "critical"
            : "warning",
      risk_score:
        alert.severity === "critical"
          ? Math.max(current.risk_score ?? 0, 0.85)
          : Math.max(current.risk_score ?? 0, 0.55),
      last_alert_at: current.last_alert_at ?? alert.created_at,
    });
  }

  return indicatorMap;
}
