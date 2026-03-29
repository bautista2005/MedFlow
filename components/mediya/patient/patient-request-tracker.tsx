"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardClock } from "lucide-react";

import type {
  PatientRequestSummary,
  PharmacySummary,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";
import { buildPrescriptionProgressSummary } from "@/lib/patient/prescription-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PatientRequestTrackerProps = {
  requests: PatientRequestSummary[];
  pharmacies: PharmacySummary[];
  onChooseAlternativePharmacy?: (requestId: number, pharmacyId: number) => Promise<void>;
  submittingRequestId?: number | null;
};

const statusLabelMap: Record<PrescriptionRequestStatus, string> = {
  pending: "Pedido recibido",
  reviewed: "En revision medica",
  prescription_uploaded: "Receta cargada",
  pharmacy_checking: "Consultando farmacia",
  no_stock_preferred: "Sin stock en farmacia preferida",
  awaiting_alternative_pharmacy: "Elegir farmacia alternativa",
  ready_for_pickup: "Listo para retirar",
  cancelled: "Pedido cancelado",
};

function getLatestRequestByMedication(requests: PatientRequestSummary[]) {
  const requestByMedication = new Map<number, PatientRequestSummary>();

  for (const request of requests) {
    const current = requestByMedication.get(request.patient_medication_id);

    if (!current) {
      requestByMedication.set(request.patient_medication_id, request);
      continue;
    }

    if (new Date(request.requested_at).getTime() > new Date(current.requested_at).getTime()) {
      requestByMedication.set(request.patient_medication_id, request);
    }
  }

  return Array.from(requestByMedication.values()).sort(
    (left, right) =>
      new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime(),
  );
}

export function PatientRequestTracker({
  requests,
  pharmacies,
  onChooseAlternativePharmacy,
  submittingRequestId,
}: PatientRequestTrackerProps) {
  const [alternativePharmacyByRequest, setAlternativePharmacyByRequest] = useState<
    Record<number, string>
  >({});
  const latestRequests = useMemo(() => getLatestRequestByMedication(requests), [requests]);

  return (
    <Card
      id="pedidos-recientes"
      className="border-blue-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(245,249,255,0.98))] shadow-[0_24px_60px_rgba(37,99,235,0.08)]"
    >
      <CardHeader className="pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">Pedidos</Badge>
            <div className="space-y-1">
              <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
                Pedidos recientes
              </CardTitle>
              <CardDescription>
                Seguimiento del estado de tus solicitudes y recetas adjuntas.
              </CardDescription>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-blue-100 bg-blue-50 text-blue-700">
            <ClipboardClock className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestRequests.map((request) => {
          const progress = buildPrescriptionProgressSummary({
            medicationName: request.medication_name,
            status: request.status,
            dismissible: false,
          });
          const isCompleted = progress.currentStep >= progress.totalSteps;

          return (
            <article
              key={request.patient_medication_id}
              className="relative overflow-hidden rounded-[20px] border border-blue-200/80 bg-[linear-gradient(180deg,_rgba(59,130,246,0.98),_rgba(37,99,235,0.98))] px-4 py-3.5 text-white shadow-[0_16px_36px_rgba(37,99,235,0.18)]"
            >
              <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-white/10 blur-[1px]" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-blue-100">
                      {progress.title}
                    </p>
                    <h3 className="text-[1.15rem] font-semibold leading-tight tracking-[-0.03em] text-white">
                      {progress.medicationName}
                    </h3>
                  </div>
                  <span className="text-lg leading-none text-white/80">×</span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white">
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white/50 border-t-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-none text-white">
                      {progress.currentStepLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Paso {progress.currentStep} de {progress.totalSteps}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div className="relative">
                    <div className="absolute left-3 right-3 top-2.5 h-[3px] rounded-full bg-white/25" />
                    <div
                      className="absolute left-3 top-2.5 h-[3px] rounded-full bg-white transition-all duration-300"
                      style={{
                        width:
                          progress.totalSteps === 1
                            ? "calc(100% - 1.5rem)"
                            : `calc(((100% - 1.5rem) * ${(progress.currentStep - 1) / (progress.totalSteps - 1)}))`,
                      }}
                    />

                    <div
                      className="relative grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${progress.totalSteps}, minmax(0, 1fr))` }}
                    >
                      {progress.steps.map((step, index) => {
                        const stepNumber = index + 1;
                        const isPast = stepNumber < progress.currentStep;
                        const isCurrent = stepNumber === progress.currentStep;

                        return (
                          <div key={`${request.prescription_request_id}-${step}`} className="flex flex-col items-center text-center">
                            <div
                              className={[
                                "relative z-[1] flex h-5 w-5 items-center justify-center rounded-full border-2",
                                isPast
                                  ? "border-white bg-white"
                                  : isCurrent
                                    ? "border-white bg-blue-300 shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
                                    : "border-white/35 bg-blue-300/25",
                              ].join(" ")}
                            >
                              {isPast ? <Check className="h-3 w-3 text-blue-700" /> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <p className="text-blue-100">{progress.progressPercentage}% completado</p>
                  <Badge className="border-white/20 bg-white/10 text-white">
                    {statusLabelMap[request.status]}
                  </Badge>
                </div>

                {progress.helperText ? (
                  <p className="mt-3 text-xs leading-5 text-blue-50">
                    {progress.helperText}
                  </p>
                ) : null}

                <div className="mt-3 space-y-1 text-xs text-blue-100">
                  <p>
                    {request.preferred_pharmacy
                      ? `Farmacia preferida: ${request.preferred_pharmacy.name}`
                      : "Sin farmacia preferida registrada"}
                  </p>
                  <p>
                    {request.assigned_pharmacy
                      ? `Farmacia actual: ${request.assigned_pharmacy.name}`
                      : "Todavía no hay farmacia asignada"}
                  </p>
                  {request.current_file ? (
                    <p>
                      Receta cargada: {request.current_file.original_filename}
                    </p>
                  ) : null}
                  {request.doctor_note ? <p>Nota médica: {request.doctor_note}</p> : null}
                </div>

                {request.status === "awaiting_alternative_pharmacy" && onChooseAlternativePharmacy ? (
                  <div className="mt-3 grid gap-2 rounded-[16px] border border-white/15 bg-white/10 p-3">
                    <p className="text-xs font-medium text-white">
                      Elegí una farmacia alternativa para continuar el pedido.
                    </p>
                    <select
                      value={alternativePharmacyByRequest[request.prescription_request_id] ?? ""}
                      onChange={(event) =>
                        setAlternativePharmacyByRequest((current) => ({
                          ...current,
                          [request.prescription_request_id]: event.target.value,
                        }))
                      }
                      className="rounded-[14px] border border-white/20 bg-white/95 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-200"
                    >
                      <option value="">Seleccionar farmacia</option>
                      {pharmacies
                        .filter(
                          (pharmacy) =>
                            pharmacy.pharmacy_id !== request.assigned_pharmacy?.pharmacy_id,
                        )
                        .map((pharmacy) => (
                          <option key={pharmacy.pharmacy_id} value={pharmacy.pharmacy_id}>
                            {pharmacy.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-9 bg-white text-blue-800 hover:bg-blue-50"
                      onClick={async () => {
                        const nextPharmacyId = Number(
                          alternativePharmacyByRequest[request.prescription_request_id],
                        );

                        if (!Number.isInteger(nextPharmacyId) || nextPharmacyId <= 0) {
                          return;
                        }

                        await onChooseAlternativePharmacy(
                          request.prescription_request_id,
                          nextPharmacyId,
                        );
                      }}
                      disabled={submittingRequestId === request.prescription_request_id}
                    >
                      {submittingRequestId === request.prescription_request_id
                        ? "Actualizando..."
                        : "Confirmar farmacia"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
