import type { WeeklyScheduleInput, WeeklyScheduleSlot } from "@/lib/calendar/types";
import type {
  CreatePatientMedicationInput,
  CreatePatientTreatmentPayload,
} from "@/lib/doctor/types";

const TIME_PATTERN = /^\d{2}:\d{2}$/;

type ValidationError = {
  error: string;
  status: number;
};

export type NormalizedPatientMedicationInput = {
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  frequency_text: string;
  pills_per_box: number | null;
  box_count: number;
  units_per_intake: number;
  intakes_per_day: number;
  start_date: string;
  next_consultation_at: string | null;
  notes: string | null;
};

export type NormalizedPatientTreatmentInput = {
  medication_name: string;
  pills_per_box: number;
  box_count: number;
  daily_dose: number;
  interval_hours: number;
  start_date: string;
  weekly_schedule: NormalizedWeeklyScheduleInput | null;
};

export type NormalizedWeeklyScheduleInput = {
  is_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string | null;
  days_of_week: number[];
  intake_slots: WeeklyScheduleSlot[];
  notes: string | null;
};

function normalizeNumericField(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function normalizeDateField(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeDateTimeField(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBooleanField(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeWeekdayValues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsedValues = value
    .map((item) => normalizeNumericField(item))
    .filter((item): item is number => Number.isFinite(item))
    .map((item) => Number(item));

  return Array.from(new Set(parsedValues));
}

function hasValidDate(value: string | null) {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function getExpectedIntakesPerDay(intervalHours: number) {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
    return null;
  }

  const intakesPerDay = 24 / intervalHours;

  if (!Number.isInteger(intakesPerDay) || intakesPerDay <= 0) {
    return null;
  }

  return intakesPerDay;
}

function normalizeTimeField(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeWeeklyScheduleInput(
  schedule: WeeklyScheduleInput | null | undefined,
  fallbackStartDate: string,
): NormalizedWeeklyScheduleInput | null {
  if (!schedule) {
    return null;
  }

  const intakeSlots = Array.isArray(schedule.intake_slots)
    ? schedule.intake_slots
        .map((slot) => ({
          slot_key: slot.slot_key?.trim() ?? "",
          label:
            typeof slot.label === "string" && slot.label.trim().length > 0
              ? slot.label.trim()
              : null,
          time: normalizeTimeField(slot.time),
        }))
        .filter((slot) => slot.slot_key.length > 0)
    : [];

  return {
    is_enabled: normalizeBooleanField(schedule.is_enabled, true),
    schedule_start_date: normalizeDateField(schedule.schedule_start_date) || fallbackStartDate,
    schedule_end_date: normalizeDateField(schedule.schedule_end_date) || null,
    days_of_week: normalizeWeekdayValues(schedule.days_of_week),
    intake_slots: intakeSlots,
    notes: typeof schedule.notes === "string" && schedule.notes.trim().length > 0
      ? schedule.notes.trim()
      : null,
  };
}

export function normalizePatientMedicationInput(
  medication: CreatePatientMedicationInput,
): NormalizedPatientMedicationInput {
  return {
    medication_name: medication.medication_name?.trim() ?? "",
    presentation: medication.presentation?.trim() || null,
    dose_text: medication.dose_text?.trim() ?? "",
    frequency_text: medication.frequency_text?.trim() ?? "",
    pills_per_box: normalizeNumericField(medication.pills_per_box),
    box_count: normalizeNumericField(medication.box_count) ?? 1,
    units_per_intake: normalizeNumericField(medication.units_per_intake) ?? Number.NaN,
    intakes_per_day: normalizeNumericField(medication.intakes_per_day) ?? Number.NaN,
    start_date: normalizeDateField(medication.start_date),
    next_consultation_at: normalizeDateTimeField(medication.next_consultation_at),
    notes: medication.notes?.trim() || null,
  };
}

export function validatePatientMedicationInput(
  medication: NormalizedPatientMedicationInput,
): ValidationError | null {
  if (!medication.medication_name) {
    return { error: "Ingresa el medicamento.", status: 400 };
  }

  if (!medication.dose_text) {
    return { error: "Ingresa la dosis del tratamiento.", status: 400 };
  }

  if (!medication.frequency_text) {
    return { error: "Ingresa la frecuencia del tratamiento.", status: 400 };
  }

  if (!medication.start_date || Number.isNaN(Date.parse(medication.start_date))) {
    return { error: "Ingresa una fecha de inicio valida.", status: 400 };
  }

  if (!Number.isFinite(medication.units_per_intake) || medication.units_per_intake <= 0) {
    return { error: "Ingresa unidades por toma validas.", status: 400 };
  }

  if (!Number.isFinite(medication.intakes_per_day) || medication.intakes_per_day <= 0) {
    return { error: "Ingresa tomas por dia validas.", status: 400 };
  }

  if (
    medication.pills_per_box !== null &&
    (!Number.isFinite(medication.pills_per_box) || medication.pills_per_box <= 0)
  ) {
    return {
      error: "Ingresa una cantidad de unidades por caja valida.",
      status: 400,
    };
  }

  if (!Number.isFinite(medication.box_count) || medication.box_count <= 0) {
    return {
      error: "Ingresa una cantidad de unidades (cajas) valida.",
      status: 400,
    };
  }

  if (
    medication.next_consultation_at !== null &&
    (!medication.next_consultation_at ||
      Number.isNaN(Date.parse(medication.next_consultation_at)))
  ) {
    return { error: "Ingresa una fecha de proxima consulta valida.", status: 400 };
  }

  return null;
}

export function normalizePatientTreatmentInput(
  medication: CreatePatientTreatmentPayload,
): NormalizedPatientTreatmentInput {
  const startDate = normalizeDateField(medication.start_date);

  return {
    medication_name: medication.medication_name?.trim() ?? "",
    pills_per_box: normalizeNumericField(medication.pills_per_box) ?? Number.NaN,
    box_count: normalizeNumericField(medication.box_count) ?? Number.NaN,
    daily_dose: normalizeNumericField(medication.daily_dose) ?? Number.NaN,
    interval_hours: normalizeNumericField(medication.interval_hours) ?? Number.NaN,
    start_date: startDate,
    weekly_schedule: normalizeWeeklyScheduleInput(medication.weekly_schedule, startDate),
  };
}

export function validatePatientTreatmentInput(
  medication: NormalizedPatientTreatmentInput,
): ValidationError | null {
  if (!medication.medication_name) {
    return { error: "Ingresa el medicamento.", status: 400 };
  }

  if (!Number.isFinite(medication.daily_dose) || medication.daily_dose <= 0) {
    return { error: "Ingresa una dosis valida.", status: 400 };
  }

  if (!Number.isFinite(medication.interval_hours) || medication.interval_hours <= 0) {
    return { error: "Ingresa un intervalo en hs valido.", status: 400 };
  }

  if (!Number.isFinite(medication.pills_per_box) || medication.pills_per_box <= 0) {
    return {
      error: "Ingresa una cantidad de unidades por caja valida.",
      status: 400,
    };
  }

  if (!Number.isFinite(medication.box_count) || medication.box_count <= 0) {
    return {
      error: "Ingresa una cantidad de unidades (cajas) valida.",
      status: 400,
    };
  }

  if (!medication.start_date || Number.isNaN(Date.parse(medication.start_date))) {
    return { error: "Ingresa una fecha de inicio valida.", status: 400 };
  }

  const schedule = medication.weekly_schedule;

  if (!schedule || !schedule.is_enabled) {
    return null;
  }

  const expectedIntakesPerDay = getExpectedIntakesPerDay(medication.interval_hours);

  if (expectedIntakesPerDay === null) {
    return {
      error: "Para usar calendario semanal el intervalo debe dividir 24 hs en tomas enteras.",
      status: 400,
    };
  }

  if (!hasValidDate(schedule.schedule_start_date)) {
    return { error: "Ingresa una fecha de inicio valida para el calendario.", status: 400 };
  }

  if (schedule.schedule_end_date !== null && !hasValidDate(schedule.schedule_end_date)) {
    return { error: "Ingresa una fecha de fin valida para el calendario.", status: 400 };
  }

  if (
    schedule.schedule_end_date !== null &&
    new Date(schedule.schedule_end_date).getTime() <
      new Date(schedule.schedule_start_date).getTime()
  ) {
    return {
      error: "La fecha de fin del calendario no puede ser anterior al inicio.",
      status: 400,
    };
  }

  if (schedule.days_of_week.length === 0) {
    return {
      error: "Selecciona al menos un dia para el calendario semanal.",
      status: 400,
    };
  }

  if (
    schedule.days_of_week.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    return {
      error: "Los dias del calendario semanal no son validos.",
      status: 400,
    };
  }

  if (schedule.intake_slots.length === 0) {
    return {
      error: "Ingresa al menos una toma o franja para el calendario semanal.",
      status: 400,
    };
  }

  if (schedule.intake_slots.length !== expectedIntakesPerDay) {
    return {
      error: `La cantidad de tomas del calendario debe coincidir con la frecuencia del tratamiento (${expectedIntakesPerDay} por dia).`,
      status: 400,
    };
  }

  const slotKeys = new Set<string>();

  for (const slot of schedule.intake_slots) {
    if (!slot.slot_key) {
      return {
        error: "Cada toma del calendario debe tener un identificador valido.",
        status: 400,
      };
    }

    if (slotKeys.has(slot.slot_key)) {
      return {
        error: "No puede haber tomas repetidas en el calendario semanal.",
        status: 400,
      };
    }

    slotKeys.add(slot.slot_key);

    if (slot.time !== null && !TIME_PATTERN.test(slot.time)) {
      return {
        error: "Los horarios del calendario deben tener formato HH:MM.",
        status: 400,
      };
    }
  }

  return null;
}
