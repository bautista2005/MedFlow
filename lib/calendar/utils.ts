import type { WeeklyScheduleConfigSummary } from "@/lib/calendar/types";

const WEEKDAY_SHORT_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateParts(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, utcDate };
}

export function isIsoDateString(value: string) {
  return parseIsoDateParts(value) !== null;
}

export function formatUtcDateToIsoDate(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function addDaysToIsoDate(value: string, days: number) {
  const parsedDate = parseIsoDateParts(value);

  if (!parsedDate) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const nextDate = new Date(parsedDate.utcDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return formatUtcDateToIsoDate(nextDate);
}

export function getIsoWeekday(value: string) {
  const parsedDate = parseIsoDateParts(value);

  if (!parsedDate) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return parsedDate.utcDate.getUTCDay();
}

export function getStartOfWeekIsoDate(value: string) {
  const parsedDate = parseIsoDateParts(value);

  if (!parsedDate) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const weekday = parsedDate.utcDate.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const weekStart = new Date(parsedDate.utcDate);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  return formatUtcDateToIsoDate(weekStart);
}

export function getTodayIsoDate() {
  return formatUtcDateToIsoDate(new Date());
}

export function formatCalendarDayLabel(value: string) {
  const parsedDate = parseIsoDateParts(value);

  if (!parsedDate) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const weekday = parsedDate.utcDate.getUTCDay();
  return `${WEEKDAY_SHORT_LABELS[weekday]} ${parsedDate.day}`;
}

export function compareNullableTimes(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

export function normalizeWeeklyScheduleSummary(
  schedule:
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
    | null,
): WeeklyScheduleConfigSummary | null {
  if (!schedule) {
    return null;
  }

  const source = Array.isArray(schedule) ? schedule[0] ?? null : schedule;

  if (!source) {
    return null;
  }

  const intakeSlots = Array.isArray(source.intake_slots)
    ? source.intake_slots
        .filter((slot): slot is Record<string, unknown> => typeof slot === "object" && slot !== null)
        .map((slot) => ({
          slot_key:
            typeof slot.slot_key === "string" && slot.slot_key.trim().length > 0
              ? slot.slot_key.trim()
              : "",
          label:
            typeof slot.label === "string" && slot.label.trim().length > 0
              ? slot.label.trim()
              : null,
          time:
            typeof slot.time === "string" && slot.time.trim().length > 0
              ? slot.time.trim()
              : null,
        }))
        .filter((slot) => slot.slot_key.length > 0)
    : [];

  return {
    weekly_schedule_config_id: source.weekly_schedule_config_id,
    is_enabled: source.is_enabled,
    schedule_start_date: source.schedule_start_date,
    schedule_end_date: source.schedule_end_date,
    days_of_week: Array.isArray(source.days_of_week)
      ? source.days_of_week.filter((day) => Number.isInteger(day))
      : [],
    intake_slots: intakeSlots,
    notes: source.notes,
  };
}
