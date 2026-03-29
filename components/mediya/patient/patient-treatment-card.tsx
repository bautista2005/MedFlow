"use client";

import { CalendarClock } from "lucide-react";

import type { PatientMedicationSummary } from "@/lib/patient/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PatientTreatmentCardProps = {
  medication: PatientMedicationSummary;
  isSubmitting: boolean;
  onRequestRefill: (payload: {
    patient_medication_id: number;
    patient_note?: string;
  }) => Promise<void>;
};

const toneClasses = {
  success: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
};

export function PatientTreatmentCard({
  medication,
  isSubmitting,
  onRequestRefill,
}: PatientTreatmentCardProps) {
  async function handleRequest() {
    await onRequestRefill({
      patient_medication_id: medication.patient_medication_id,
    });
  }

  const width = medication.calculation.can_calculate
    ? `${Math.max(0, Math.min(100, (medication.calculation.remaining_percentage ?? 0) * 100))}%`
    : "18%";

  return (
    <Card className="border border-white/70 bg-white/92 shadow-[0_14px_30px_rgba(37,99,235,0.08)] hover:border-blue-100 hover:shadow-[0_18px_40px_rgba(37,99,235,0.1)]">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">
              {medication.is_active ? "Tratamiento activo" : "Tratamiento"}
            </Badge>
            <CardTitle className="font-sans text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              {medication.medication_name}
            </CardTitle>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p className="font-medium text-blue-900">{medication.doctor.name}</p>
            <p>{medication.doctor.organization || "Profesional asignado"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2.5 rounded-[18px] bg-[linear-gradient(180deg,_rgba(239,246,255,0.9),_rgba(255,255,255,0.72))] px-4 py-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-700" />
              <p className="font-medium text-blue-900">Consumo estimado</p>
            </div>
            <p className="text-slate-500">
              {medication.calculation.can_calculate && medication.calculation.remaining_days !== null
                ? `${medication.calculation.remaining_days} dias restantes`
                : "Informacion incompleta"}
            </p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full transition-all ${toneClasses[medication.calculation.status_tone]}`}
              style={{ width }}
            />
          </div>
          <p className="text-sm text-slate-600">
            {medication.calculation.can_calculate
              ? `Duracion estimada: ${medication.calculation.estimated_duration_days} dias.`
              : "Informacion incompleta para estimar reposicion."}
          </p>
        </div>

        {medication.notes ? (
          <div className="px-1 text-sm leading-6 text-slate-600">
            {medication.notes}
          </div>
        ) : null}

        <div className="pt-0.5">
          <Button
            className="h-11 w-full bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)]"
            type="button"
            onClick={handleRequest}
            disabled={!medication.calculation.can_request_refill || isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Solucitar nueva receta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
