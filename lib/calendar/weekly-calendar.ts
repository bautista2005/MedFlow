import type {
  DoctorWeeklyCalendarMedication,
  DoctorWeeklyCalendarResponse,
  PatientWeeklyCalendarDay,
  PatientWeeklyCalendarDose,
  PatientWeeklyCalendarResponse,
  WeeklyCalendarStatusSummary,
  WeeklyScheduleConfigSummary,
  WeeklyScheduleLogStatus,
} from "@/lib/calendar/types";
import {
  addDaysToIsoDate,
  compareNullableTimes,
  formatCalendarDayLabel,
  formatUtcDateToIsoDate,
  getIsoWeekday,
  getStartOfWeekIsoDate,
  getTodayIsoDate,
  isIsoDateString,
  normalizeWeeklyScheduleSummary,
} from "@/lib/calendar/utils";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type WeeklyScheduleRelation = {
  weekly_schedule_config_id: number;
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[] | null;
  intake_slots: unknown;
  notes: string | null;
};

type MedicationCalendarRow = {
  patient_medication_id: number;
  patient_id: number;
  active_doctor_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  frequency_text: string;
  units_per_intake: number | null;
  is_active: boolean;
  start_date: string;
  weekly_schedule_configs: WeeklyScheduleRelation | WeeklyScheduleRelation[] | null;
};

type WeeklyScheduleLogRow = {
  weekly_schedule_log_id: number;
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  scheduled_time: string | null;
  status: WeeklyScheduleLogStatus;
  note: string | null;
  logged_at: string;
  taken_at: string | null;
};

type MedicationWithSchedule = Omit<MedicationCalendarRow, "weekly_schedule_configs"> & {
  weekly_schedule: WeeklyScheduleConfigSummary;
};

type LoadedCalendarContext = {
  allActiveMedications: MedicationCalendarRow[];
  medicationsWithSchedules: MedicationWithSchedule[];
  logByDoseKey: Map<string, WeeklyScheduleLogRow>;
};

export class InvalidCalendarWeekError extends Error {
  constructor(message = "La semana solicitada no tiene un formato valido.") {
    super(message);
    this.name = "InvalidCalendarWeekError";
  }
}

function resolveWeekStart(weekStart?: string) {
  const candidate = weekStart ?? formatUtcDateToIsoDate(new Date());

  if (!isIsoDateString(candidate)) {
    throw new InvalidCalendarWeekError();
  }

  return getStartOfWeekIsoDate(candidate);
}

function intersectsSelectedWeek(
  schedule: WeeklyScheduleConfigSummary,
  weekStart: string,
  weekEnd: string,
) {
  if (schedule.schedule_start_date > weekEnd) {
    return false;
  }

  if (schedule.schedule_end_date !== null && schedule.schedule_end_date < weekStart) {
    return false;
  }

  return true;
}

function getOccurrenceStartDate(
  medicationStartDate: string,
  scheduleStartDate: string,
  weekStart: string,
) {
  const effectiveStartDate =
    medicationStartDate > scheduleStartDate ? medicationStartDate : scheduleStartDate;

  return effectiveStartDate > weekStart ? effectiveStartDate : weekStart;
}

function buildLogLookupKey(configId: number, date: string, slotKey: string) {
  return `${configId}:${date}:${slotKey}`;
}

function sortDoses(doses: PatientWeeklyCalendarDose[]) {
  return doses.sort((left, right) => {
    const timeOrder = compareNullableTimes(left.slot_time, right.slot_time);

    if (timeOrder !== 0) {
      return timeOrder;
    }

    const labelOrder = (left.slot_label ?? "").localeCompare(right.slot_label ?? "");

    if (labelOrder !== 0) {
      return labelOrder;
    }

    return left.medication_name.localeCompare(right.medication_name);
  });
}

function buildEmptySummary(): WeeklyCalendarStatusSummary {
  return {
    scheduled: 0,
    taken: 0,
    taken_late: 0,
    missed: 0,
    pending: 0,
  };
}

function summarizeDoses(doses: PatientWeeklyCalendarDose[]) {
  return doses.reduce<WeeklyCalendarStatusSummary>((summary, dose) => {
    summary.scheduled += 1;

    switch (dose.status) {
      case "taken":
        summary.taken += 1;
        break;
      case "taken_late":
        summary.taken_late += 1;
        break;
      case "missed":
        summary.missed += 1;
        break;
      default:
        summary.pending += 1;
        break;
    }

    return summary;
  }, buildEmptySummary());
}

function buildWeekDayMap(weekStart: string) {
  const dayMap = new Map<string, PatientWeeklyCalendarDay>();
  const today = getTodayIsoDate();

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = addDaysToIsoDate(weekStart, dayOffset);

    dayMap.set(date, {
      date,
      weekday: getIsoWeekday(date),
      label: formatCalendarDayLabel(date),
      is_today: date === today,
      doses: [],
    });
  }

  return dayMap;
}

function buildDaysFromDayMap(dayMap: Map<string, PatientWeeklyCalendarDay>) {
  return Array.from(dayMap.values()).map((day) => ({
    ...day,
    doses: sortDoses(day.doses),
  }));
}

function buildEmptyPatientCalendar(weekStart: string): PatientWeeklyCalendarResponse {
  return {
    week_start: weekStart,
    week_end: addDaysToIsoDate(weekStart, 6),
    has_calendar: false,
    days: [],
  };
}

function buildEmptyDoctorCalendar({
  weekStart,
  hasTreatments,
  hasSchedule,
}: {
  weekStart: string;
  hasTreatments: boolean;
  hasSchedule: boolean;
}): DoctorWeeklyCalendarResponse {
  return {
    week_start: weekStart,
    week_end: addDaysToIsoDate(weekStart, 6),
    has_treatments: hasTreatments,
    has_schedule: hasSchedule,
    has_calendar: false,
    summary: buildEmptySummary(),
    medications: [],
  };
}

function buildOccurrencesForMedication({
  medication,
  logByDoseKey,
  weekStart,
  weekEnd,
}: {
  medication: MedicationWithSchedule;
  logByDoseKey: Map<string, WeeklyScheduleLogRow>;
  weekStart: string;
  weekEnd: string;
}) {
  const doses: PatientWeeklyCalendarDose[] = [];
  const firstEligibleDate = getOccurrenceStartDate(
    medication.start_date,
    medication.weekly_schedule.schedule_start_date,
    weekStart,
  );
  const lastEligibleDate =
    medication.weekly_schedule.schedule_end_date !== null &&
    medication.weekly_schedule.schedule_end_date < weekEnd
      ? medication.weekly_schedule.schedule_end_date
      : weekEnd;

  if (firstEligibleDate > lastEligibleDate) {
    return doses;
  }

  for (let cursorDate = firstEligibleDate; cursorDate <= lastEligibleDate; ) {
    const weekday = getIsoWeekday(cursorDate);

    if (medication.weekly_schedule.days_of_week.includes(weekday)) {
      for (const slot of medication.weekly_schedule.intake_slots) {
        const log = logByDoseKey.get(
          buildLogLookupKey(
            medication.weekly_schedule.weekly_schedule_config_id,
            cursorDate,
            slot.slot_key,
          ),
        );

        doses.push({
          weekly_schedule_config_id: medication.weekly_schedule.weekly_schedule_config_id,
          patient_medication_id: medication.patient_medication_id,
          medication_name: medication.medication_name,
          presentation: medication.presentation,
          dose_text: medication.dose_text,
          units_per_intake: medication.units_per_intake,
          frequency_text: medication.frequency_text,
          slot_key: slot.slot_key,
          slot_label: slot.label,
          slot_time: slot.time,
          scheduled_for_date: cursorDate,
          status: log?.status ?? "pending",
          log_id: log?.weekly_schedule_log_id ?? null,
          logged_at: log?.logged_at ?? null,
          taken_at: log?.taken_at ?? null,
          note: log?.note ?? null,
        });
      }
    }

    cursorDate = addDaysToIsoDate(cursorDate, 1);
  }

  return doses;
}

async function loadCalendarContext({
  patientId,
  weekStart,
  activeDoctorId,
}: {
  patientId: number;
  weekStart: string;
  activeDoctorId?: number;
}): Promise<LoadedCalendarContext> {
  const weekEnd = addDaysToIsoDate(weekStart, 6);
  const supabase = createAdminSupabaseClient();

  let medicationsQuery = supabase
    .from("patient_medications")
    .select(
      "patient_medication_id, patient_id, active_doctor_id, medication_name, presentation, dose_text, frequency_text, units_per_intake, is_active, start_date, weekly_schedule_configs(weekly_schedule_config_id, is_enabled, schedule_start_date, schedule_end_date, days_of_week, intake_slots, notes)",
    )
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  if (typeof activeDoctorId === "number") {
    medicationsQuery = medicationsQuery.eq("active_doctor_id", activeDoctorId);
  }

  const { data: medicationRows, error: medicationsError } = await medicationsQuery;

  if (medicationsError) {
    throw new Error("No se pudo cargar el calendario.");
  }

  const allActiveMedications = (medicationRows ?? []) as MedicationCalendarRow[];
  const medicationsWithSchedules = allActiveMedications
    .map((row) => {
      const { weekly_schedule_configs: weeklyScheduleConfigs, ...medication } = row;

      return {
        ...medication,
        weekly_schedule: normalizeWeeklyScheduleSummary(weeklyScheduleConfigs),
      };
    })
    .filter(
      (
        row,
      ): row is MedicationWithSchedule =>
        row.weekly_schedule !== null &&
        row.weekly_schedule.is_enabled &&
        row.start_date <= weekEnd &&
        intersectsSelectedWeek(row.weekly_schedule, weekStart, weekEnd),
    );

  if (medicationsWithSchedules.length === 0) {
    return {
      allActiveMedications,
      medicationsWithSchedules,
      logByDoseKey: new Map<string, WeeklyScheduleLogRow>(),
    };
  }

  let logsQuery = supabase
    .from("weekly_schedule_logs")
    .select(
      "weekly_schedule_log_id, weekly_schedule_config_id, patient_medication_id, scheduled_for_date, slot_key, scheduled_time, status, note, logged_at, taken_at",
    )
    .eq("patient_id", patientId)
    .gte("scheduled_for_date", weekStart)
    .lte("scheduled_for_date", weekEnd);

  if (typeof activeDoctorId === "number") {
    logsQuery = logsQuery.eq("active_doctor_id", activeDoctorId);
  }

  const { data: logRows, error: logsError } = await logsQuery;

  if (logsError) {
    throw new Error("No se pudo cargar el calendario.");
  }

  return {
    allActiveMedications,
    medicationsWithSchedules,
    logByDoseKey: new Map<string, WeeklyScheduleLogRow>(
      ((logRows ?? []) as WeeklyScheduleLogRow[]).map((row) => [
        buildLogLookupKey(row.weekly_schedule_config_id, row.scheduled_for_date, row.slot_key),
        row,
      ]),
    ),
  };
}

export async function buildPatientWeeklyCalendar({
  patientId,
  weekStart,
}: {
  patientId: number;
  weekStart?: string;
}): Promise<PatientWeeklyCalendarResponse> {
  const normalizedWeekStart = resolveWeekStart(weekStart);
  const weekEnd = addDaysToIsoDate(normalizedWeekStart, 6);
  const { medicationsWithSchedules, logByDoseKey } = await loadCalendarContext({
    patientId,
    weekStart: normalizedWeekStart,
  });

  if (medicationsWithSchedules.length === 0) {
    return buildEmptyPatientCalendar(normalizedWeekStart);
  }

  const dayMap = buildWeekDayMap(normalizedWeekStart);

  for (const medication of medicationsWithSchedules) {
    const doses = buildOccurrencesForMedication({
      medication,
      logByDoseKey,
      weekStart: normalizedWeekStart,
      weekEnd,
    });

    for (const dose of doses) {
      dayMap.get(dose.scheduled_for_date)?.doses.push(dose);
    }
  }

  const days = buildDaysFromDayMap(dayMap);

  if (!days.some((day) => day.doses.length > 0)) {
    return buildEmptyPatientCalendar(normalizedWeekStart);
  }

  return {
    week_start: normalizedWeekStart,
    week_end: weekEnd,
    has_calendar: true,
    days,
  };
}

export async function buildDoctorPatientWeeklyCalendar({
  patientId,
  activeDoctorId,
  weekStart,
}: {
  patientId: number;
  activeDoctorId: number;
  weekStart?: string;
}): Promise<DoctorWeeklyCalendarResponse> {
  const normalizedWeekStart = resolveWeekStart(weekStart);
  const weekEnd = addDaysToIsoDate(normalizedWeekStart, 6);
  const { allActiveMedications, medicationsWithSchedules, logByDoseKey } =
    await loadCalendarContext({
      patientId,
      activeDoctorId,
      weekStart: normalizedWeekStart,
    });
  const hasTreatments = allActiveMedications.length > 0;
  const hasSchedule = allActiveMedications.some((medication) => {
    const schedule = normalizeWeeklyScheduleSummary(medication.weekly_schedule_configs);
    return schedule?.is_enabled ?? false;
  });

  if (medicationsWithSchedules.length === 0) {
    return buildEmptyDoctorCalendar({
      weekStart: normalizedWeekStart,
      hasTreatments,
      hasSchedule,
    });
  }

  const medications: DoctorWeeklyCalendarMedication[] = medicationsWithSchedules
    .map((medication) => {
      const doses = buildOccurrencesForMedication({
        medication,
        logByDoseKey,
        weekStart: normalizedWeekStart,
        weekEnd,
      });

      if (doses.length === 0) {
        return null;
      }

      const dayMap = buildWeekDayMap(normalizedWeekStart);

      for (const dose of doses) {
        dayMap.get(dose.scheduled_for_date)?.doses.push(dose);
      }

      return {
        patient_medication_id: medication.patient_medication_id,
        medication_name: medication.medication_name,
        presentation: medication.presentation,
        dose_text: medication.dose_text,
        frequency_text: medication.frequency_text,
        units_per_intake: medication.units_per_intake,
        start_date: medication.start_date,
        schedule: medication.weekly_schedule,
        summary: summarizeDoses(doses),
        days: buildDaysFromDayMap(dayMap),
      };
    })
    .filter((medication): medication is DoctorWeeklyCalendarMedication => medication !== null)
    .sort((left, right) => left.medication_name.localeCompare(right.medication_name));

  if (medications.length === 0) {
    return buildEmptyDoctorCalendar({
      weekStart: normalizedWeekStart,
      hasTreatments,
      hasSchedule,
    });
  }

  const summary = medications.reduce<WeeklyCalendarStatusSummary>((accumulator, medication) => {
    accumulator.scheduled += medication.summary.scheduled;
    accumulator.taken += medication.summary.taken;
    accumulator.taken_late += medication.summary.taken_late;
    accumulator.missed += medication.summary.missed;
    accumulator.pending += medication.summary.pending;
    return accumulator;
  }, buildEmptySummary());

  return {
    week_start: normalizedWeekStart,
    week_end: weekEnd,
    has_treatments: hasTreatments,
    has_schedule: hasSchedule,
    has_calendar: true,
    summary,
    medications,
  };
}
