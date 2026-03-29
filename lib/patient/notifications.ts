import type {
  DoctorMessageNotificationKind,
  DoctorMessageNotificationMetadata,
  PatientNotificationCategory,
  PatientNotificationListResponse,
  PatientNotificationPriority,
  PatientNotificationSource,
  PatientNotificationStatus,
  PatientNotificationStatusFilter,
  PatientNotificationSummary,
  PatientNotificationType,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";
import { buildPrescriptionProgressSummary } from "@/lib/patient/prescription-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const FORCE_AUTO_READY_FOR_PICKUP_FOR_TESTING = true;
const AUTO_READY_FOR_PICKUP_DELAY_MS = 5_000;

export class PatientNotificationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PatientNotificationError";
    this.status = status;
  }
}

type PatientNotificationRow = {
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
  metadata: Record<string, unknown> | null;
  scheduled_for: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationPrescriptionRequestRow = {
  prescription_request_id: number;
  medication_name_snapshot: string;
  status: PrescriptionRequestStatus;
};

type CreatePatientNotificationInput = {
  patientId: number;
  activeDoctorId?: number | null;
  patientMedicationId?: number | null;
  prescriptionRequestId?: number | null;
  weeklyScheduleConfigId?: number | null;
  source?: PatientNotificationSource;
  category: PatientNotificationCategory;
  type: PatientNotificationType;
  title: string;
  message: string;
  priority?: PatientNotificationPriority;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  scheduledFor?: string | null;
  dedupeKey?: string | null;
};

type CreatePrescriptionRequestNotificationInput = {
  patientId: number;
  activeDoctorId?: number | null;
  patientMedicationId: number;
  prescriptionRequestId: number;
  medicationName: string;
  preferredPharmacyId?: number | null;
  assignedPharmacyId?: number | null;
  pharmacyId?: number | null;
  pharmacyName?: string | null;
  fromStatus?: PrescriptionRequestStatus | null;
  toStatus?: PrescriptionRequestStatus | null;
  resolvedStatus?: PrescriptionRequestStatus;
  fileUploadedAt?: string;
  type:
    | "prescription_request_created"
    | "prescription_request_waiting_doctor"
    | "prescription_file_uploaded"
    | "prescription_request_pharmacy_checking"
    | "prescription_request_no_stock_preferred"
    | "prescription_request_choose_alternative_pharmacy"
    | "prescription_request_ready_for_pickup";
};

type PrescriptionWorkflowRequest = {
  prescriptionRequestId: number;
  patientId: number;
  activeDoctorId: number | null;
  patientMedicationId: number;
  medicationName: string;
  status: PrescriptionRequestStatus;
  preferredPharmacyId: number | null;
  assignedPharmacyId: number | null;
};

type TransitionPrescriptionRequestStatusInput = {
  request: PrescriptionWorkflowRequest;
  nextStatus:
    | "prescription_uploaded"
    | "pharmacy_checking"
    | "no_stock_preferred"
    | "awaiting_alternative_pharmacy"
    | "ready_for_pickup"
    | "cancelled";
  pharmacyName?: string | null;
  pharmacyId?: number | null;
  assignedPharmacyId?: number | null;
  resolvedAt?: string | null;
  fileUploadedAt?: string;
};

type AutoAdvancePrescriptionRequestsOptions = {
  activeDoctorId?: number;
  patientId?: number;
};

type CreateCalendarNotificationInput = {
  patientId: number;
  activeDoctorId?: number | null;
  patientMedicationId: number;
  weeklyScheduleConfigId: number;
  medicationName: string;
  scheduledForDate: string;
  slotKey: string;
  slotLabel?: string | null;
  scheduledTime?: string | null;
  type: "calendar_dose_reminder" | "calendar_missed_dose";
  reason?: "upcoming" | "pending" | "manual_missed";
};

type CreateSystemNotificationInput = {
  patientId: number;
  activeDoctorId?: number | null;
  patientMedicationId: number;
  medicationName: string;
  nextConsultationAt?: string | null;
  remainingDays?: number | null;
  type: "medication_running_low" | "follow_up_reminder";
};

type CreateDoctorObservationNotificationInput = {
  patientId: number;
  activeDoctorId: number;
  patientMedicationId?: number | null;
  prescriptionRequestId?: number | null;
  medicationName?: string | null;
  title?: string | null;
  observation: string;
};

type CreateDoctorMessageNotificationInput = {
  patientId: number;
  activeDoctorId: number;
  patientMedicationId?: number | null;
  prescriptionRequestId?: number | null;
  medicationName?: string | null;
  title: string;
  message: string;
  type: "doctor_observation_created" | "doctor_follow_up_requested" | "doctor_chatbot_alert_acknowledged";
  messageKind: DoctorMessageNotificationKind;
  observation: string;
  dedupeKey?: string | null;
};

const patientNotificationSelect =
  "patient_notification_id, patient_id, active_doctor_id, patient_medication_id, prescription_request_id, weekly_schedule_config_id, source, category, type, title, message, status, priority, action_url, metadata, scheduled_for, read_at, created_at, updated_at";

function mapPatientNotification(
  row: PatientNotificationRow,
  requestById?: Map<number, NotificationPrescriptionRequestRow>,
): PatientNotificationSummary {
  const linkedRequest =
    row.category === "prescription" && typeof row.prescription_request_id === "number"
      ? requestById?.get(row.prescription_request_id) ?? null
      : null;

  return {
    patient_notification_id: row.patient_notification_id,
    patient_id: row.patient_id,
    active_doctor_id: row.active_doctor_id,
    patient_medication_id: row.patient_medication_id,
    prescription_request_id: row.prescription_request_id,
    weekly_schedule_config_id: row.weekly_schedule_config_id,
    source: row.source,
    category: row.category,
    type: row.type,
    title: row.title,
    message: row.message,
    status: row.status,
    priority: row.priority,
    action_url: row.action_url,
    metadata: row.metadata ?? {},
    scheduled_for: row.scheduled_for,
    read_at: row.read_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    prescription_progress: linkedRequest
      ? buildPrescriptionProgressSummary({
          medicationName: linkedRequest.medication_name_snapshot,
          status: linkedRequest.status,
          dismissible: row.status === "unread",
        })
      : null,
  };
}

export function normalizePatientNotificationStatusFilter(
  value: string | null,
): PatientNotificationStatusFilter {
  if (!value || value === "all") {
    return "all";
  }

  if (value === "unread" || value === "read") {
    return value;
  }

  throw new PatientNotificationError("El filtro de notificaciones no es valido.", 400);
}

export function normalizePatientNotificationLimit(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new PatientNotificationError("El limite de notificaciones no es valido.", 400);
  }

  const limit = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new PatientNotificationError("El limite de notificaciones no es valido.", 400);
  }

  return limit;
}

export async function createPatientNotification(
  input: CreatePatientNotificationInput,
): Promise<PatientNotificationSummary | null> {
  const supabase = createAdminSupabaseClient();
  const payload = {
    patient_id: input.patientId,
    active_doctor_id: input.activeDoctorId ?? null,
    patient_medication_id: input.patientMedicationId ?? null,
    prescription_request_id: input.prescriptionRequestId ?? null,
    weekly_schedule_config_id: input.weeklyScheduleConfigId ?? null,
    source: input.source ?? "system",
    category: input.category,
    type: input.type,
    title: input.title,
    message: input.message,
    priority: input.priority ?? "normal",
    action_url: input.actionUrl ?? null,
    metadata: input.metadata ?? {},
    scheduled_for: input.scheduledFor ?? null,
    dedupe_key: input.dedupeKey ?? null,
  };

  const { data, error } = await supabase
    .from("patient_notifications")
    .insert(payload)
    .select(patientNotificationSelect)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return null;
    }

    throw new PatientNotificationError("No se pudo registrar la notificacion.", 500);
  }

  if (!data) {
    return null;
  }

  return mapPatientNotification(data as PatientNotificationRow);
}

export async function createPrescriptionRequestNotification(
  input: CreatePrescriptionRequestNotificationInput,
) {
  const metadata: Record<string, unknown> = {
    prescription_request_id: input.prescriptionRequestId,
    patient_id: input.patientId,
    patient_medication_id: input.patientMedicationId,
    medication_name: input.medicationName,
  };

  if (typeof input.preferredPharmacyId === "number") {
    metadata.preferred_pharmacy_id = input.preferredPharmacyId;
  }

  if (typeof input.assignedPharmacyId === "number") {
    metadata.assigned_pharmacy_id = input.assignedPharmacyId;
  }

  if (typeof input.pharmacyId === "number") {
    metadata.pharmacy_id = input.pharmacyId;
  }

  if (input.pharmacyName) {
    metadata.pharmacy_name = input.pharmacyName;
  }

  if (input.fromStatus) {
    metadata.from_status = input.fromStatus;
  }

  if (input.toStatus) {
    metadata.to_status = input.toStatus;
  }

  if (input.fileUploadedAt) {
    metadata.file_uploaded_at = input.fileUploadedAt;
  }

  if (input.resolvedStatus) {
    metadata.resolved_status = input.resolvedStatus;
  }

  switch (input.type) {
    case "prescription_request_created":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "system",
        category: "prescription",
        type: input.type,
        title: "Tu pedido fue enviado",
        message: `Ya recibimos tu solicitud para ${input.medicationName}.`,
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_created:${input.prescriptionRequestId}`,
      });
    case "prescription_request_waiting_doctor":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "system",
        category: "prescription",
        type: input.type,
        title: "Esperando respuesta del medico",
        message: "Tu pedido esta en revision por el equipo medico.",
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_waiting_doctor:${input.prescriptionRequestId}`,
      });
    case "prescription_file_uploaded":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "doctor",
        category: "prescription",
        type: input.type,
        title: "Tu medico ya cargo la receta",
        message: `Ya adjuntamos la receta para ${input.medicationName}.`,
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_file_uploaded:${input.prescriptionRequestId}:${input.fileUploadedAt ?? "latest"}`,
      });
    case "prescription_request_pharmacy_checking":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "pharmacy",
        category: "prescription",
        type: input.type,
        title: "Consultando stock en farmacia",
        message: input.pharmacyName
          ? `Estamos consultando disponibilidad en ${input.pharmacyName}.`
          : "Estamos consultando disponibilidad en tu farmacia asignada.",
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_pharmacy_checking:${input.prescriptionRequestId}:${input.assignedPharmacyId ?? "none"}`,
      });
    case "prescription_request_no_stock_preferred":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "pharmacy",
        category: "prescription",
        type: input.type,
        title: "No hay stock en tu farmacia de preferencia",
        message: "La farmacia seleccionada no tiene stock para continuar el pedido.",
        priority: "high",
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_no_stock_preferred:${input.prescriptionRequestId}:${input.assignedPharmacyId ?? "none"}`,
      });
    case "prescription_request_choose_alternative_pharmacy":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "pharmacy",
        category: "prescription",
        type: input.type,
        title: "Elegi otra farmacia para continuar",
        message: "Selecciona una farmacia alternativa para seguir con tu pedido.",
        priority: "high",
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_choose_alternative_pharmacy:${input.prescriptionRequestId}:${input.assignedPharmacyId ?? "none"}`,
      });
    case "prescription_request_ready_for_pickup":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        prescriptionRequestId: input.prescriptionRequestId,
        source: "pharmacy",
        category: "prescription",
        type: input.type,
        title: "Tu medicacion esta lista para retirar",
        message: input.pharmacyName
          ? `Ya podes retirar ${input.medicationName} en ${input.pharmacyName}.`
          : `Ya podes retirar ${input.medicationName}.`,
        priority: "high",
        actionUrl: "/paciente#pedidos-recientes",
        metadata,
        dedupeKey: `prescription_request_ready_for_pickup:${input.prescriptionRequestId}:${input.assignedPharmacyId ?? "none"}`,
      });
    default:
      return null;
  }
}

function getPrescriptionTransitionNotificationType(
  status: TransitionPrescriptionRequestStatusInput["nextStatus"],
) {
  switch (status) {
    case "prescription_uploaded":
      return "prescription_file_uploaded" as const;
    case "pharmacy_checking":
      return "prescription_request_pharmacy_checking" as const;
    case "no_stock_preferred":
      return "prescription_request_no_stock_preferred" as const;
    case "awaiting_alternative_pharmacy":
      return "prescription_request_choose_alternative_pharmacy" as const;
    case "ready_for_pickup":
      return "prescription_request_ready_for_pickup" as const;
    default:
      return null;
  }
}

export async function transitionPrescriptionRequestStatus(
  input: TransitionPrescriptionRequestStatusInput,
) {
  const supabase = createAdminSupabaseClient();
  const nextAssignedPharmacyId =
    input.assignedPharmacyId === undefined
      ? input.request.assignedPharmacyId
      : input.assignedPharmacyId;
  const resolvedAt =
    input.resolvedAt === undefined
      ? input.nextStatus === "ready_for_pickup" || input.nextStatus === "cancelled"
        ? new Date().toISOString()
        : null
      : input.resolvedAt;

  const { data, error } = await supabase
    .from("prescription_requests")
    .update({
      status: input.nextStatus,
      assigned_pharmacy_id: nextAssignedPharmacyId,
      resolved_at: resolvedAt,
    })
    .eq("prescription_request_id", input.request.prescriptionRequestId)
    .select(
      "prescription_request_id, patient_id, active_doctor_id, patient_medication_id, status, medication_name_snapshot, preferred_pharmacy_id, assigned_pharmacy_id",
    )
    .maybeSingle();

  if (error || !data) {
    throw new PatientNotificationError("No se pudo actualizar el estado del pedido.", 500);
  }

  const notificationType = getPrescriptionTransitionNotificationType(input.nextStatus);

  if (notificationType) {
    await createPrescriptionRequestNotification({
      type: notificationType,
      patientId: data.patient_id,
      activeDoctorId: data.active_doctor_id,
      patientMedicationId: data.patient_medication_id,
      prescriptionRequestId: data.prescription_request_id,
      medicationName: data.medication_name_snapshot,
      preferredPharmacyId: data.preferred_pharmacy_id,
      assignedPharmacyId: data.assigned_pharmacy_id,
      pharmacyId: input.pharmacyId ?? data.assigned_pharmacy_id,
      pharmacyName: input.pharmacyName,
      fromStatus: input.request.status,
      toStatus: data.status,
      fileUploadedAt: input.fileUploadedAt,
    });
  }

  return {
    prescriptionRequestId: data.prescription_request_id,
    patientId: data.patient_id,
    activeDoctorId: data.active_doctor_id,
    patientMedicationId: data.patient_medication_id,
    medicationName: data.medication_name_snapshot,
    status: data.status,
    preferredPharmacyId: data.preferred_pharmacy_id,
    assignedPharmacyId: data.assigned_pharmacy_id,
  } satisfies PrescriptionWorkflowRequest;
}

export async function autoAdvanceTestingPrescriptionRequests(
  options: AutoAdvancePrescriptionRequestsOptions = {},
) {
  if (!FORCE_AUTO_READY_FOR_PICKUP_FOR_TESTING) {
    return;
  }

  const cutoffIso = new Date(Date.now() - AUTO_READY_FOR_PICKUP_DELAY_MS).toISOString();
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("prescription_requests")
    .select(
      "prescription_request_id, patient_id, active_doctor_id, patient_medication_id, status, medication_name_snapshot, preferred_pharmacy_id, assigned_pharmacy_id, updated_at, assigned_pharmacy:pharmacies!prescription_requests_assigned_pharmacy_id_fkey(pharmacy_id, name)",
    )
    .eq("status", "pharmacy_checking")
    .lte("updated_at", cutoffIso);

  if (typeof options.activeDoctorId === "number") {
    query = query.eq("active_doctor_id", options.activeDoctorId);
  }

  if (typeof options.patientId === "number") {
    query = query.eq("patient_id", options.patientId);
  }

  const { data: staleRequests, error } = await query;

  if (error || !staleRequests?.length) {
    return;
  }

  await Promise.allSettled(
    staleRequests.map((request) => {
      const assignedPharmacy = Array.isArray(request.assigned_pharmacy)
        ? (request.assigned_pharmacy[0] ?? null)
        : request.assigned_pharmacy;

      return transitionPrescriptionRequestStatus({
        request: {
          prescriptionRequestId: request.prescription_request_id,
          patientId: request.patient_id,
          activeDoctorId: request.active_doctor_id,
          patientMedicationId: request.patient_medication_id,
          medicationName: request.medication_name_snapshot,
          status: request.status,
          preferredPharmacyId: request.preferred_pharmacy_id,
          assignedPharmacyId: request.assigned_pharmacy_id,
        },
        nextStatus: "ready_for_pickup",
        pharmacyId: assignedPharmacy?.pharmacy_id ?? request.assigned_pharmacy_id,
        pharmacyName: assignedPharmacy?.name ?? null,
        resolvedAt: new Date().toISOString(),
      });
    }),
  );
}

function buildScheduledForTimestamp(date: string, time?: string | null) {
  if (!time) {
    return `${date}T00:00:00.000Z`;
  }

  return `${date}T${time}:00.000Z`;
}

export async function createCalendarNotification(input: CreateCalendarNotificationInput) {
  const reason =
    input.reason ??
    (input.type === "calendar_dose_reminder" ? "upcoming" : "manual_missed");
  const metadata: Record<string, unknown> = {
    patient_medication_id: input.patientMedicationId,
    weekly_schedule_config_id: input.weeklyScheduleConfigId,
    medication_name: input.medicationName,
    scheduled_for_date: input.scheduledForDate,
    slot_key: input.slotKey,
    notification_reason: reason,
  };

  if (input.slotLabel) {
    metadata.slot_label = input.slotLabel;
  }

  if (input.scheduledTime) {
    metadata.scheduled_time = input.scheduledTime;
  }

  switch (input.type) {
    case "calendar_dose_reminder":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        weeklyScheduleConfigId: input.weeklyScheduleConfigId,
        source: "calendar",
        category: "calendar",
        type: input.type,
        title: "Recordatorio de toma",
        message: input.scheduledTime
          ? `Toma ${input.medicationName} a las ${input.scheduledTime}.`
          : `Tene presente registrar la toma de ${input.medicationName} hoy.`,
        actionUrl: "/paciente",
        metadata,
        scheduledFor: buildScheduledForTimestamp(input.scheduledForDate, input.scheduledTime),
        dedupeKey: `calendar_dose_reminder:${input.weeklyScheduleConfigId}:${input.scheduledForDate}:${input.slotKey}:${reason}`,
      });
    case "calendar_missed_dose":
      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        weeklyScheduleConfigId: input.weeklyScheduleConfigId,
        source: "calendar",
        category: "calendar",
        type: input.type,
        title:
          reason === "pending" ? "Toma pendiente por registrar" : "Toma marcada como omitida",
        message:
          reason === "pending"
            ? input.slotLabel
              ? `Todavia no registraste la toma ${input.slotLabel} de ${input.medicationName}.`
              : `Todavia no registraste la toma de ${input.medicationName}.`
            : input.slotLabel
              ? `Registramos como omitida la toma ${input.slotLabel} de ${input.medicationName}.`
              : `Registramos una toma omitida de ${input.medicationName}.`,
        priority: "high",
        actionUrl: "/paciente",
        metadata,
        scheduledFor: buildScheduledForTimestamp(input.scheduledForDate, input.scheduledTime),
        dedupeKey: `calendar_missed_dose:${input.weeklyScheduleConfigId}:${input.scheduledForDate}:${input.slotKey}:${reason}`,
      });
    default:
      return null;
  }
}

export async function createSystemNotification(input: CreateSystemNotificationInput) {
  const metadata: Record<string, unknown> = {
    patient_medication_id: input.patientMedicationId,
    medication_name: input.medicationName,
  };

  switch (input.type) {
    case "medication_running_low": {
      if (typeof input.remainingDays === "number") {
        metadata.remaining_days = input.remainingDays;
      }

      const refillBucket =
        typeof input.remainingDays === "number" && input.remainingDays <= 3
          ? "critical"
          : "soon";

      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        source: "system",
        category: "system",
        type: input.type,
        title: "Podria hacer falta una nueva receta",
        message: `Detectamos que ${input.medicationName} podria necesitar reposicion pronto.`,
        priority: "high",
        actionUrl: "/paciente",
        metadata,
        dedupeKey: `medication_running_low:${input.patientMedicationId}:${refillBucket}`,
      });
    }
    case "follow_up_reminder": {
      if (!input.nextConsultationAt) {
        return null;
      }

      metadata.next_consultation_at = input.nextConsultationAt;

      return createPatientNotification({
        patientId: input.patientId,
        activeDoctorId: input.activeDoctorId,
        patientMedicationId: input.patientMedicationId,
        source: "system",
        category: "system",
        type: input.type,
        title: "Consulta de seguimiento cercana",
        message: `Tu seguimiento para ${input.medicationName} esta proximo. Revisa la fecha con tu medico.`,
        actionUrl: "/paciente",
        metadata,
        scheduledFor: input.nextConsultationAt,
        dedupeKey: `follow_up_reminder:${input.patientMedicationId}:${input.nextConsultationAt}`,
      });
    }
    default:
      return null;
  }
}

export async function createDoctorObservationNotification(
  input: CreateDoctorObservationNotificationInput,
) {
  const normalizedObservation = input.observation.trim();

  if (!normalizedObservation) {
    return null;
  }

  return createDoctorMessageNotification({
    patientId: input.patientId,
    activeDoctorId: input.activeDoctorId,
    patientMedicationId: input.patientMedicationId ?? null,
    prescriptionRequestId: input.prescriptionRequestId ?? null,
    medicationName: input.medicationName ?? null,
    title: input.title?.trim() || "Nueva observacion del medico",
    message: input.medicationName
      ? `Tu medico dejo una observacion sobre ${input.medicationName}: ${normalizedObservation}`
      : `Tu medico dejo una nueva observacion: ${normalizedObservation}`,
    type: "doctor_observation_created",
    messageKind: "observation",
    observation: normalizedObservation,
    dedupeKey: input.prescriptionRequestId
      ? `doctor_observation_created:${input.prescriptionRequestId}:${normalizedObservation}`
      : null,
  });
}

export async function createDoctorFollowUpNotification(input: {
  patientId: number;
  activeDoctorId: number;
  patientMedicationId?: number | null;
  title?: string | null;
  message: string;
}) {
  const normalizedMessage = input.message.trim();

  if (!normalizedMessage) {
    return null;
  }

  return createDoctorMessageNotification({
    patientId: input.patientId,
    activeDoctorId: input.activeDoctorId,
    patientMedicationId: input.patientMedicationId ?? null,
    title: input.title?.trim() || "Seguimiento solicitado por tu medico",
    message: normalizedMessage,
    type: "doctor_follow_up_requested",
    messageKind: "follow_up",
    observation: normalizedMessage,
    dedupeKey: null,
  });
}

export async function createDoctorChatbotAcknowledgementNotification(input: {
  patientId: number;
  activeDoctorId: number;
  patientChatLogId?: number | null;
  message: string;
}) {
  const normalizedMessage = input.message.trim();

  if (!normalizedMessage) {
    return null;
  }

  return createDoctorMessageNotification({
    patientId: input.patientId,
    activeDoctorId: input.activeDoctorId,
    title: "Tu medico reviso una alerta del asistente",
    message: normalizedMessage,
    type: "doctor_chatbot_alert_acknowledged",
    messageKind: "chatbot_acknowledged",
    observation: normalizedMessage,
    dedupeKey: input.patientChatLogId
      ? `doctor_chatbot_alert_acknowledged:${input.patientChatLogId}`
      : null,
  });
}

async function createDoctorMessageNotification(input: CreateDoctorMessageNotificationInput) {
  const metadata: DoctorMessageNotificationMetadata = {
    doctor_id: input.activeDoctorId,
    patient_id: input.patientId,
    message_kind: input.messageKind,
    observation: input.observation,
    ...(typeof input.prescriptionRequestId === "number"
      ? { related_prescription_id: input.prescriptionRequestId }
      : {}),
    ...(typeof input.patientMedicationId === "number"
      ? { related_treatment_id: input.patientMedicationId }
      : {}),
    ...(input.medicationName ? { medication_name: input.medicationName } : {}),
  };

  return createPatientNotification({
    patientId: input.patientId,
    activeDoctorId: input.activeDoctorId,
    patientMedicationId: input.patientMedicationId ?? null,
    prescriptionRequestId: input.prescriptionRequestId ?? null,
    source: "doctor",
    category: "doctor_message",
    type: input.type,
    title: input.title,
    message: input.message,
    priority: "normal",
    actionUrl: "/paciente/notificaciones",
    metadata,
    dedupeKey: input.dedupeKey ?? null,
  });
}

export async function listPatientNotifications(input: {
  patientId: number;
  status: PatientNotificationStatusFilter;
  limit?: number | null;
}): Promise<PatientNotificationListResponse> {
  const supabase = createAdminSupabaseClient();
  let notificationsQuery = supabase
    .from("patient_notifications")
    .select(patientNotificationSelect)
    .eq("patient_id", input.patientId)
    .order("created_at", { ascending: false });

  if (input.status !== "all") {
    notificationsQuery = notificationsQuery.eq("status", input.status);
  }

  if (typeof input.limit === "number") {
    notificationsQuery = notificationsQuery.limit(input.limit);
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    notificationsQuery,
    supabase
      .from("patient_notifications")
      .select("patient_notification_id", { count: "exact", head: true })
      .eq("patient_id", input.patientId)
      .eq("status", "unread"),
  ]);

  if (error || countError) {
    throw new PatientNotificationError("No se pudieron cargar las notificaciones.", 500);
  }

  const notificationRows = (data ?? []) as PatientNotificationRow[];
  const prescriptionRequestIds = notificationRows
    .filter(
      (row): row is PatientNotificationRow & { prescription_request_id: number } =>
        row.category === "prescription" && typeof row.prescription_request_id === "number",
    )
    .map((row) => row.prescription_request_id);

  let requestById = new Map<number, NotificationPrescriptionRequestRow>();

  if (prescriptionRequestIds.length > 0) {
    const { data: requestRows, error: requestsError } = await createAdminSupabaseClient()
      .from("prescription_requests")
      .select("prescription_request_id, medication_name_snapshot, status")
      .eq("patient_id", input.patientId)
      .in("prescription_request_id", prescriptionRequestIds);

    if (requestsError) {
      throw new PatientNotificationError("No se pudieron cargar las notificaciones.", 500);
    }

    requestById = new Map(
      ((requestRows ?? []) as NotificationPrescriptionRequestRow[]).map((request) => [
        request.prescription_request_id,
        request,
      ]),
    );
  }

  return {
    notifications: notificationRows.map((row) => mapPatientNotification(row, requestById)),
    unread_count: count ?? 0,
  };
}

export async function markPatientNotificationRead(input: {
  patientId: number;
  patientNotificationId: number;
}): Promise<PatientNotificationSummary> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("patient_notifications")
    .update({
      status: "read",
      read_at: now,
    })
    .eq("patient_notification_id", input.patientNotificationId)
    .eq("patient_id", input.patientId)
    .select(patientNotificationSelect)
    .maybeSingle();

  if (error) {
    throw new PatientNotificationError("No se pudo actualizar la notificacion.", 500);
  }

  if (!data) {
    throw new PatientNotificationError("La notificacion no existe.", 404);
  }

  return mapPatientNotification(data as PatientNotificationRow);
}

export async function markAllPatientNotificationsRead(input: {
  patientId: number;
}): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("patient_notifications")
    .update({
      status: "read",
      read_at: now,
    })
    .eq("patient_id", input.patientId)
    .eq("status", "unread")
    .select("patient_notification_id");

  if (error) {
    throw new PatientNotificationError("No se pudieron marcar las notificaciones.", 500);
  }

  return data?.length ?? 0;
}
