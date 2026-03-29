import type {
  PrescriptionProgressStepLabel,
  PrescriptionProgressSummary,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";

export const PRESCRIPTION_PROGRESS_STEPS: PrescriptionProgressStepLabel[] = [
  "Solicitud enviada",
  "Receta validada",
  "Pedido aprobado",
  "Farmacia asignada",
  "Listo para retirar",
];

const statusLabelMap: Record<PrescriptionRequestStatus, string> = {
  pending: "Solicitud enviada",
  reviewed: "Solicitud enviada",
  prescription_uploaded: "Receta validada",
  pharmacy_checking: "Pedido aprobado",
  no_stock_preferred: "Farmacia asignada",
  awaiting_alternative_pharmacy: "Farmacia asignada",
  ready_for_pickup: "Listo para retirar",
  cancelled: "Pedido cancelado",
};

const statusHelperMap: Partial<Record<PrescriptionRequestStatus, string>> = {
  reviewed: "Tu solicitud ya fue tomada por el equipo médico.",
  prescription_uploaded: "La receta fue validada y ya se cargó al pedido.",
  pharmacy_checking: "Estamos coordinando la disponibilidad con la farmacia.",
  no_stock_preferred: "La farmacia actual informó falta de stock.",
  awaiting_alternative_pharmacy: "Necesitamos que elijas una farmacia alternativa para seguir.",
  ready_for_pickup: "Ya podés acercarte a la farmacia para retirarlo.",
  cancelled: "El pedido se cerró antes de completar el circuito.",
};

function getCurrentStep(status: PrescriptionRequestStatus) {
  switch (status) {
    case "pending":
    case "reviewed":
      return 1;
    case "prescription_uploaded":
      return 2;
    case "pharmacy_checking":
      return 3;
    case "no_stock_preferred":
    case "awaiting_alternative_pharmacy":
      return 4;
    case "ready_for_pickup":
      return 5;
    case "cancelled":
    default:
      return 1;
  }
}

export function buildPrescriptionProgressSummary(input: {
  medicationName: string;
  status: PrescriptionRequestStatus;
  dismissible?: boolean;
}): PrescriptionProgressSummary {
  const currentStep = getCurrentStep(input.status);
  const totalSteps = PRESCRIPTION_PROGRESS_STEPS.length;
  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

  return {
    title: input.status === "ready_for_pickup" ? "Pedido listo" : "Pedido en proceso",
    medicationName: input.medicationName,
    currentStep,
    totalSteps,
    steps: PRESCRIPTION_PROGRESS_STEPS,
    progressPercentage,
    dismissible: input.dismissible ?? true,
    currentStepLabel: statusLabelMap[input.status],
    helperText: statusHelperMap[input.status] ?? null,
    currentStatus: input.status,
  };
}
