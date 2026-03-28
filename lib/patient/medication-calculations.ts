import type {
  MedicationBlockedReason,
  MedicationCalculation,
} from "@/lib/patient/types";

const FORCE_ENABLE_REFILL_FOR_TESTING = true;

type MedicationInput = {
  pills_per_box: number | null;
  box_count: number;
  units_per_intake: number | null;
  intakes_per_day: number | null;
  start_date: string;
};

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function diffDays(from: Date, to: Date) {
  const milliseconds = to.getTime() - from.getTime();
  return Math.floor(milliseconds / 86_400_000);
}

function getBlockedMessage(reason: MedicationBlockedReason | null) {
  switch (reason) {
    case "missing_data":
      return "Faltan datos del tratamiento para calcular una nueva reposicion.";
    case "too_early":
      return "Todavia deberias tener medicacion disponible.";
    case "request_in_progress":
      return "Ya hay un pedido en curso para este tratamiento.";
    default:
      return null;
  }
}

export function calculateMedicationStatus(
  medication: MedicationInput,
  options?: {
    hasOpenRequest?: boolean;
    today?: Date;
  },
): MedicationCalculation {
  const today = startOfDay(options?.today ?? new Date());
  const startDate = new Date(`${medication.start_date}T00:00:00.000Z`);
  const hasCalculationInputs =
    Boolean(medication.start_date) &&
    medication.pills_per_box !== null &&
    medication.pills_per_box > 0 &&
    medication.units_per_intake !== null &&
    medication.units_per_intake > 0 &&
    medication.intakes_per_day !== null &&
    medication.intakes_per_day > 0 &&
    medication.box_count > 0 &&
    !Number.isNaN(startDate.getTime());

  if (!hasCalculationInputs) {
    return {
      can_calculate: false,
      daily_units: null,
      total_units: null,
      estimated_duration_days: null,
      elapsed_days: null,
      remaining_days: null,
      remaining_percentage: null,
      status_tone: "neutral",
      can_request_refill: false,
      blocked_reason: "missing_data",
      blocked_message: getBlockedMessage("missing_data"),
    };
  }

  const dailyUnits = Number(medication.units_per_intake) * Number(medication.intakes_per_day);
  const totalUnits = Number(medication.pills_per_box) * medication.box_count;
  const estimatedDurationDays = totalUnits / dailyUnits;
  const elapsedDays = Math.max(0, diffDays(startOfDay(startDate), today));
  const remainingDays = estimatedDurationDays - elapsedDays;
  const remainingPercentage = Math.max(0, remainingDays / estimatedDurationDays);
  const toleranceDays = estimatedDurationDays * 0.2;
  const baseEligible = remainingDays <= toleranceDays || remainingDays <= 0;
  const blockedReason = FORCE_ENABLE_REFILL_FOR_TESTING
    ? null
    : options?.hasOpenRequest
      ? "request_in_progress"
      : baseEligible
        ? null
        : "too_early";

  let statusTone: MedicationCalculation["status_tone"] = "success";

  if (remainingPercentage < 0.15) {
    statusTone = "danger";
  } else if (remainingPercentage <= 0.4) {
    statusTone = "warning";
  }

  return {
    can_calculate: true,
    daily_units: Number(dailyUnits.toFixed(2)),
    total_units: totalUnits,
    estimated_duration_days: Number(estimatedDurationDays.toFixed(1)),
    elapsed_days: elapsedDays,
    remaining_days: Number(remainingDays.toFixed(1)),
    remaining_percentage: Number(remainingPercentage.toFixed(4)),
    status_tone: statusTone,
    can_request_refill: blockedReason === null,
    blocked_reason: blockedReason,
    blocked_message: FORCE_ENABLE_REFILL_FOR_TESTING
      ? "Modo prueba activo: podes enviar pedidos desde cualquier tratamiento."
      : getBlockedMessage(blockedReason),
  };
}
