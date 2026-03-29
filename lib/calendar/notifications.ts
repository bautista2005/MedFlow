import type { WeeklyScheduleConfigSummary, WeeklyScheduleSlot } from "@/lib/calendar/types";
import {
  addDaysToIsoDate,
  formatUtcDateToIsoDate,
  getIsoWeekday,
  isIsoDateString,
  normalizeWeeklyScheduleSummary,
} from "@/lib/calendar/utils";
import { createCalendarNotification } from "@/lib/patient/notifications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type CalendarNotificationReason = "upcoming" | "pending";

type CalendarNotificationDispatchOptions = {
  referenceAt?: string | Date;
  upcomingWindowMinutes?: number;
  pendingGraceMinutes?: number;
  pendingLookbackDays?: number;
  includeUpcoming?: boolean;
  includePending?: boolean;
};

type CalendarScheduleRow = {
  patient_medication_id: number;
  patient_id: number;
  active_doctor_id: number;
  medication_name: string;
  is_active: boolean;
  start_date: string;
  patients:
    | {
        account_status: "invited" | "active" | "disabled";
      }
    | {
        account_status: "invited" | "active" | "disabled";
      }[]
    | null;
  weekly_schedule_configs:
    | {
        weekly_schedule_config_id: number;
        is_enabled: boolean;
        schedule_start_date: string;
        schedule_end_date: string | null;
        days_of_week: number[] | null;
        intake_slots: unknown;
        notes: string | null;
      }
    | {
        weekly_schedule_config_id: number;
        is_enabled: boolean;
        schedule_start_date: string;
        schedule_end_date: string | null;
        days_of_week: number[] | null;
        intake_slots: unknown;
        notes: string | null;
      }[]
    | null;
};

type WeeklyScheduleLogRow = {
  weekly_schedule_config_id: number;
  scheduled_for_date: string;
  slot_key: string;
};

type EligibleCalendarSchedule = {
  patientMedicationId: number;
  patientId: number;
  activeDoctorId: number;
  medicationName: string;
  startDate: string;
  schedule: WeeklyScheduleConfigSummary;
};

type LoadedCalendarNotificationContext = {
  schedules: EligibleCalendarSchedule[];
  logKeys: Set<string>;
};

type CalendarNotificationDispatchSummary = {
  processed_doses: number;
  created: number;
  duplicates: number;
  existing_logs: number;
  upcoming_created: number;
  pending_created: number;
  upcoming_duplicates: number;
  pending_duplicates: number;
};

type CalendarNotificationDispatchResult = CalendarNotificationDispatchSummary & {
  reference_at: string;
  upcoming_window_minutes: number;
  pending_grace_minutes: number;
  pending_lookback_days: number;
};

const DEFAULT_UPCOMING_WINDOW_MINUTES = 90;
const DEFAULT_PENDING_GRACE_MINUTES = 90;
const DEFAULT_PENDING_LOOKBACK_DAYS = 2;

export class CalendarNotificationDispatchError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CalendarNotificationDispatchError";
    this.status = status;
  }
}

function normalizeNumberOption(value: number | undefined, fallback: number, label: string) {
  if (typeof value === "undefined") {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new CalendarNotificationDispatchError(`${label} debe ser un entero positivo o cero.`);
  }

  return value;
}

function resolveReferenceAt(referenceAt?: string | Date) {
  if (typeof referenceAt === "undefined") {
    return new Date();
  }

  const resolvedDate = referenceAt instanceof Date ? referenceAt : new Date(referenceAt);

  if (Number.isNaN(resolvedDate.getTime())) {
    throw new CalendarNotificationDispatchError(
      "La fecha de referencia para las notificaciones no es valida.",
    );
  }

  return resolvedDate;
}

function buildLogLookupKey(configId: number, date: string, slotKey: string) {
  return `${configId}:${date}:${slotKey}`;
}

function buildSlotTimestamp(date: string, time: string | null) {
  if (!time) {
    return null;
  }

  return new Date(`${date}T${time}:00.000Z`);
}

function resolveAccountStatus(
  value:
    | {
        account_status: "invited" | "active" | "disabled";
      }
    | {
        account_status: "invited" | "active" | "disabled";
      }[]
    | null,
) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.account_status ?? null;
  }

  return value.account_status;
}

function buildEmptySummary(): CalendarNotificationDispatchSummary {
  return {
    processed_doses: 0,
    created: 0,
    duplicates: 0,
    existing_logs: 0,
    upcoming_created: 0,
    pending_created: 0,
    upcoming_duplicates: 0,
    pending_duplicates: 0,
  };
}

function mergeSummary(
  target: CalendarNotificationDispatchSummary,
  partial: CalendarNotificationDispatchSummary,
) {
  target.processed_doses += partial.processed_doses;
  target.created += partial.created;
  target.duplicates += partial.duplicates;
  target.existing_logs += partial.existing_logs;
  target.upcoming_created += partial.upcoming_created;
  target.pending_created += partial.pending_created;
  target.upcoming_duplicates += partial.upcoming_duplicates;
  target.pending_duplicates += partial.pending_duplicates;
  return target;
}

function isScheduleActiveOnDate({
  schedule,
  medicationStartDate,
  date,
}: {
  schedule: WeeklyScheduleConfigSummary;
  medicationStartDate: string;
  date: string;
}) {
  if (!schedule.is_enabled) {
    return false;
  }

  if (date < medicationStartDate || date < schedule.schedule_start_date) {
    return false;
  }

  if (schedule.schedule_end_date !== null && date > schedule.schedule_end_date) {
    return false;
  }

  return schedule.days_of_week.includes(getIsoWeekday(date));
}

async function loadCalendarNotificationContext({
  minDate,
  maxDate,
}: {
  minDate: string;
  maxDate: string;
}): Promise<LoadedCalendarNotificationContext> {
  const supabase = createAdminSupabaseClient();
  const { data: scheduleRows, error: schedulesError } = await supabase
    .from("patient_medications")
    .select(
      "patient_medication_id, patient_id, active_doctor_id, medication_name, is_active, start_date, patients(account_status), weekly_schedule_configs(weekly_schedule_config_id, is_enabled, schedule_start_date, schedule_end_date, days_of_week, intake_slots, notes)",
    )
    .eq("is_active", true)
    .order("patient_medication_id", { ascending: true });

  if (schedulesError) {
    throw new Error("No se pudieron cargar los tratamientos con calendario.");
  }

  const schedules = ((scheduleRows ?? []) as CalendarScheduleRow[])
    .map((row) => {
      const schedule = normalizeWeeklyScheduleSummary(row.weekly_schedule_configs);
      const accountStatus = resolveAccountStatus(row.patients);

      if (!schedule || !row.is_active || accountStatus !== "active") {
        return null;
      }

      if (row.start_date > maxDate || schedule.schedule_start_date > maxDate) {
        return null;
      }

      if (
        (schedule.schedule_end_date !== null && schedule.schedule_end_date < minDate) ||
        schedule.days_of_week.length === 0 ||
        schedule.intake_slots.length === 0
      ) {
        return null;
      }

      return {
        patientMedicationId: row.patient_medication_id,
        patientId: row.patient_id,
        activeDoctorId: row.active_doctor_id,
        medicationName: row.medication_name,
        startDate: row.start_date,
        schedule,
      } satisfies EligibleCalendarSchedule;
    })
    .filter((row): row is EligibleCalendarSchedule => row !== null);

  if (schedules.length === 0) {
    return {
      schedules,
      logKeys: new Set<string>(),
    };
  }

  const { data: logRows, error: logsError } = await supabase
    .from("weekly_schedule_logs")
    .select("weekly_schedule_config_id, scheduled_for_date, slot_key")
    .gte("scheduled_for_date", minDate)
    .lte("scheduled_for_date", maxDate);

  if (logsError) {
    throw new Error("No se pudieron cargar los registros del calendario.");
  }

  return {
    schedules,
    logKeys: new Set<string>(
      ((logRows ?? []) as WeeklyScheduleLogRow[]).map((row) =>
        buildLogLookupKey(row.weekly_schedule_config_id, row.scheduled_for_date, row.slot_key),
      ),
    ),
  };
}

function shouldEmitUpcomingNotification({
  date,
  slot,
  referenceAt,
  upcomingWindowEnd,
  referenceDate,
}: {
  date: string;
  slot: WeeklyScheduleSlot;
  referenceAt: Date;
  upcomingWindowEnd: Date;
  referenceDate: string;
}) {
  if (!slot.time) {
    return date === referenceDate;
  }

  const slotTimestamp = buildSlotTimestamp(date, slot.time);

  if (!slotTimestamp) {
    return false;
  }

  return slotTimestamp >= referenceAt && slotTimestamp <= upcomingWindowEnd;
}

function shouldEmitPendingNotification({
  date,
  slot,
  pendingCutoff,
  referenceDate,
}: {
  date: string;
  slot: WeeklyScheduleSlot;
  pendingCutoff: Date;
  referenceDate: string;
}) {
  if (!slot.time) {
    return date < referenceDate;
  }

  const slotTimestamp = buildSlotTimestamp(date, slot.time);

  if (!slotTimestamp) {
    return false;
  }

  return slotTimestamp <= pendingCutoff;
}

async function emitNotificationsForReason({
  schedules,
  logKeys,
  minDate,
  maxDate,
  referenceAt,
  upcomingWindowMinutes,
  pendingGraceMinutes,
  reason,
}: {
  schedules: EligibleCalendarSchedule[];
  logKeys: Set<string>;
  minDate: string;
  maxDate: string;
  referenceAt: Date;
  upcomingWindowMinutes: number;
  pendingGraceMinutes: number;
  reason: CalendarNotificationReason;
}) {
  const summary = buildEmptySummary();
  const referenceDate = formatUtcDateToIsoDate(referenceAt);
  const upcomingWindowEnd = new Date(referenceAt.getTime() + upcomingWindowMinutes * 60_000);
  const pendingCutoff = new Date(referenceAt.getTime() - pendingGraceMinutes * 60_000);

  for (const scheduleEntry of schedules) {
    for (let date = minDate; date <= maxDate; date = addDaysToIsoDate(date, 1)) {
      if (
        !isScheduleActiveOnDate({
          schedule: scheduleEntry.schedule,
          medicationStartDate: scheduleEntry.startDate,
          date,
        })
      ) {
        continue;
      }

      for (const slot of scheduleEntry.schedule.intake_slots) {
        const logKey = buildLogLookupKey(
          scheduleEntry.schedule.weekly_schedule_config_id,
          date,
          slot.slot_key,
        );

        if (logKeys.has(logKey)) {
          summary.existing_logs += 1;
          continue;
        }

        const shouldEmit =
          reason === "upcoming"
            ? shouldEmitUpcomingNotification({
                date,
                slot,
                referenceAt,
                upcomingWindowEnd,
                referenceDate,
              })
            : shouldEmitPendingNotification({
                date,
                slot,
                pendingCutoff,
                referenceDate,
              });

        if (!shouldEmit) {
          continue;
        }

        summary.processed_doses += 1;

        const notification = await createCalendarNotification({
          type: reason === "upcoming" ? "calendar_dose_reminder" : "calendar_missed_dose",
          reason,
          patientId: scheduleEntry.patientId,
          activeDoctorId: scheduleEntry.activeDoctorId,
          patientMedicationId: scheduleEntry.patientMedicationId,
          weeklyScheduleConfigId: scheduleEntry.schedule.weekly_schedule_config_id,
          medicationName: scheduleEntry.medicationName,
          scheduledForDate: date,
          slotKey: slot.slot_key,
          slotLabel: slot.label,
          scheduledTime: slot.time,
        });

        if (notification) {
          summary.created += 1;

          if (reason === "upcoming") {
            summary.upcoming_created += 1;
          } else {
            summary.pending_created += 1;
          }

          continue;
        }

        summary.duplicates += 1;

        if (reason === "upcoming") {
          summary.upcoming_duplicates += 1;
        } else {
          summary.pending_duplicates += 1;
        }
      }
    }
  }

  return summary;
}

export async function emitUpcomingDoseReminders({
  context,
  minDate,
  maxDate,
  referenceAt,
  upcomingWindowMinutes,
  pendingGraceMinutes,
}: {
  context: LoadedCalendarNotificationContext;
  minDate: string;
  maxDate: string;
  referenceAt: Date;
  upcomingWindowMinutes: number;
  pendingGraceMinutes: number;
}) {
  return emitNotificationsForReason({
    schedules: context.schedules,
    logKeys: context.logKeys,
    minDate,
    maxDate,
    referenceAt,
    upcomingWindowMinutes,
    pendingGraceMinutes,
    reason: "upcoming",
  });
}

export async function emitPendingDoseNotifications({
  context,
  minDate,
  maxDate,
  referenceAt,
  upcomingWindowMinutes,
  pendingGraceMinutes,
}: {
  context: LoadedCalendarNotificationContext;
  minDate: string;
  maxDate: string;
  referenceAt: Date;
  upcomingWindowMinutes: number;
  pendingGraceMinutes: number;
}) {
  return emitNotificationsForReason({
    schedules: context.schedules,
    logKeys: context.logKeys,
    minDate,
    maxDate,
    referenceAt,
    upcomingWindowMinutes,
    pendingGraceMinutes,
    reason: "pending",
  });
}

export async function emitCalendarNotifications(
  options: CalendarNotificationDispatchOptions = {},
): Promise<CalendarNotificationDispatchResult> {
  const referenceAt = resolveReferenceAt(options.referenceAt);
  const upcomingWindowMinutes = normalizeNumberOption(
    options.upcomingWindowMinutes,
    DEFAULT_UPCOMING_WINDOW_MINUTES,
    "upcomingWindowMinutes",
  );
  const pendingGraceMinutes = normalizeNumberOption(
    options.pendingGraceMinutes,
    DEFAULT_PENDING_GRACE_MINUTES,
    "pendingGraceMinutes",
  );
  const pendingLookbackDays = normalizeNumberOption(
    options.pendingLookbackDays,
    DEFAULT_PENDING_LOOKBACK_DAYS,
    "pendingLookbackDays",
  );
  const includeUpcoming = options.includeUpcoming ?? true;
  const includePending = options.includePending ?? true;

  if (!includeUpcoming && !includePending) {
    throw new CalendarNotificationDispatchError(
      "Debe habilitar upcoming, pending o ambos para ejecutar el proceso.",
    );
  }

  const referenceDate = formatUtcDateToIsoDate(referenceAt);
  const upcomingWindowEnd = new Date(referenceAt.getTime() + upcomingWindowMinutes * 60_000);
  const maxDate = formatUtcDateToIsoDate(upcomingWindowEnd);
  const minDate = addDaysToIsoDate(referenceDate, -pendingLookbackDays);

  if (!isIsoDateString(minDate) || !isIsoDateString(maxDate)) {
    throw new CalendarNotificationDispatchError("No se pudo resolver el rango de fechas.");
  }

  const context = await loadCalendarNotificationContext({
    minDate,
    maxDate,
  });
  const summary = buildEmptySummary();

  if (includeUpcoming) {
    mergeSummary(
      summary,
      await emitUpcomingDoseReminders({
        context,
        minDate: referenceDate,
        maxDate,
        referenceAt,
        upcomingWindowMinutes,
        pendingGraceMinutes,
      }),
    );
  }

  if (includePending) {
    mergeSummary(
      summary,
      await emitPendingDoseNotifications({
        context,
        minDate,
        maxDate: referenceDate,
        referenceAt,
        upcomingWindowMinutes,
        pendingGraceMinutes,
      }),
    );
  }

  return {
    reference_at: referenceAt.toISOString(),
    upcoming_window_minutes: upcomingWindowMinutes,
    pending_grace_minutes: pendingGraceMinutes,
    pending_lookback_days: pendingLookbackDays,
    ...summary,
  };
}
