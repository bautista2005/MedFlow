import { ClipboardClock } from "lucide-react";

import type { PatientRequestSummary, PrescriptionRequestStatus } from "@/lib/patient/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PatientRequestTrackerProps = {
  requests: PatientRequestSummary[];
};

const statusLabelMap: Record<PrescriptionRequestStatus, string> = {
  pending: "Pedido recibido",
  reviewed: "En revision medica",
  accepted: "Aceptado por farmacia",
  rejected: "Pedido rechazado",
  cancelled: "Pedido cancelado",
};

const statusClassNameMap: Record<PrescriptionRequestStatus, string> = {
  pending: "border-blue-200 bg-blue-50 text-blue-900",
  reviewed: "border-blue-200 bg-blue-50 text-blue-900",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rejected: "border-rose-200 bg-rose-50 text-rose-900",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700",
};

export function PatientRequestTracker({
  requests,
}: PatientRequestTrackerProps) {
  return (
    <Card className="border-blue-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(245,249,255,0.98))] shadow-[0_24px_60px_rgba(37,99,235,0.08)]">
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
                  <h3 className="font-semibold text-blue-900">
                    {request.medication_name}
                  </h3>
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
                {request.patient_note ? (
                  <p>Tu observacion: {request.patient_note}</p>
                ) : null}
                {request.doctor_note ? (
                  <p>Nota medica: {request.doctor_note}</p>
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
