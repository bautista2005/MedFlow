"use client";

import { useState } from "react";
import { ClipboardClock } from "lucide-react";

import type {
  PatientRequestSummary,
  PharmacySummary,
  PrescriptionRequestStatus,
} from "@/lib/patient/types";
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

const statusClassNameMap: Record<PrescriptionRequestStatus, string> = {
  pending: "border-blue-200 bg-blue-50 text-blue-900",
  reviewed: "border-blue-200 bg-blue-50 text-blue-900",
  prescription_uploaded: "border-violet-200 bg-violet-50 text-violet-900",
  pharmacy_checking: "border-amber-200 bg-amber-50 text-amber-900",
  no_stock_preferred: "border-rose-200 bg-rose-50 text-rose-900",
  awaiting_alternative_pharmacy: "border-amber-200 bg-amber-50 text-amber-900",
  ready_for_pickup: "border-emerald-200 bg-emerald-50 text-emerald-900",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700",
};

const workflowSteps: Array<{
  status: PrescriptionRequestStatus;
  label: string;
}> = [
  { status: "pending", label: "Pedido enviado" },
  { status: "reviewed", label: "Revision medica" },
  { status: "prescription_uploaded", label: "Receta cargada" },
  { status: "pharmacy_checking", label: "Consulta en farmacia" },
  { status: "awaiting_alternative_pharmacy", label: "Farmacia alternativa" },
  { status: "ready_for_pickup", label: "Listo para retirar" },
];

const workflowStepIndex = new Map(workflowSteps.map((step, index) => [step.status, index]));

function getStepIndex(status: PrescriptionRequestStatus) {
  if (status === "no_stock_preferred") {
    return workflowStepIndex.get("pharmacy_checking") ?? 0;
  }

  return workflowStepIndex.get(status) ?? 0;
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
        {requests.map((request) => (
          <div
            key={request.prescription_request_id}
            className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-blue-200 hover:shadow-[0_18px_36px_rgba(37,99,235,0.10)]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-blue-900">{request.medication_name}</h3>
                  <Badge className={statusClassNameMap[request.status]}>
                    {statusLabelMap[request.status]}
                  </Badge>
                </div>
                <p>Pedido: {new Date(request.requested_at).toLocaleString("es-AR")}</p>
                <p>
                  {request.preferred_pharmacy
                    ? `Farmacia preferida: ${request.preferred_pharmacy.name}`
                    : "Sin farmacia preferida registrada"}
                </p>
                <p>
                  {request.assigned_pharmacy
                    ? `Farmacia actual: ${request.assigned_pharmacy.name}`
                    : "Todavia no hay farmacia asignada"}
                </p>
                {request.patient_note ? <p>Tu observacion: {request.patient_note}</p> : null}
                {request.doctor_note ? <p>Nota medica: {request.doctor_note}</p> : null}

                <div className="grid gap-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Estado del flujo
                  </p>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {workflowSteps.map((step, index) => {
                      const isReached = index <= getStepIndex(request.status);
                      const isCurrent =
                        step.status === request.status ||
                        (request.status === "no_stock_preferred" &&
                          step.status === "pharmacy_checking");

                      return (
                        <div
                          key={`${request.prescription_request_id}-${step.status}`}
                          className={[
                            "rounded-[14px] border px-3 py-2 text-xs font-medium",
                            isCurrent
                              ? "border-blue-200 bg-blue-50 text-blue-900"
                              : isReached
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                          ].join(" ")}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {request.status === "no_stock_preferred" ? (
                  <p className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    La farmacia asignada informo falta de stock.
                  </p>
                ) : null}

                {request.status === "awaiting_alternative_pharmacy" && onChooseAlternativePharmacy ? (
                  <div className="grid gap-2 rounded-[16px] border border-amber-200 bg-amber-50/70 p-3">
                    <p className="text-sm font-medium text-amber-900">
                      Elegi una farmacia alternativa para continuar el pedido.
                    </p>
                    <select
                      value={alternativePharmacyByRequest[request.prescription_request_id] ?? ""}
                      onChange={(event) =>
                        setAlternativePharmacyByRequest((current) => ({
                          ...current,
                          [request.prescription_request_id]: event.target.value,
                        }))
                      }
                      className="rounded-[14px] border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-200"
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

              <div className="rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                {request.current_file ? (
                  <div className="space-y-1">
                    <p className="font-medium text-blue-900">
                      {request.current_file.original_filename}
                    </p>
                    <p>
                      Cargada el{" "}
                      {new Date(request.current_file.uploaded_at).toLocaleString("es-AR")}
                    </p>
                  </div>
                ) : (
                  <p>La receta todavia no fue cargada.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
