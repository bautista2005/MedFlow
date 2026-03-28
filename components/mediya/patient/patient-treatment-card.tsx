"use client";

import { useState } from "react";
import { CalendarClock, Pill } from "lucide-react";

import type { PatientMedicationSummary } from "@/lib/patient/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [note, setNote] = useState("");

  async function handleRequest() {
    await onRequestRefill({
      patient_medication_id: medication.patient_medication_id,
      patient_note: note.trim() || undefined,
    });
    setNote("");
  }

  const width = medication.calculation.can_calculate
    ? `${Math.max(0, Math.min(100, (medication.calculation.remaining_percentage ?? 0) * 100))}%`
    : "18%";

  return (
    <Card className="border-blue-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,248,255,0.98))] shadow-[0_24px_60px_rgba(37,99,235,0.08)] hover:border-blue-200 hover:shadow-[0_28px_72px_rgba(37,99,235,0.12)]">
      <CardHeader className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">
              {medication.is_active ? "Tratamiento activo" : "Tratamiento"}
            </Badge>
            <CardTitle className="font-sans text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              {medication.medication_name}
            </CardTitle>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white/90 px-4 py-3 text-right text-sm text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <p className="font-medium text-blue-900">{medication.doctor.name}</p>
            <p>{medication.doctor.organization || "Profesional asignado"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Dosis
            </p>
            <p className="mt-1 font-medium text-slate-800">{medication.dose_text}</p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Frecuencia
            </p>
            <p className="mt-1 font-medium text-slate-800">{medication.frequency_text}</p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Presentación
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {medication.presentation ?? "Sin detalle"}
            </p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Inicio
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {new Date(`${medication.start_date}T00:00:00`).toLocaleDateString("es-AR")}
            </p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Cajas indicadas
            </p>
            <p className="mt-1 font-medium text-slate-800">{medication.box_count}</p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Unidades por caja
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {medication.pills_per_box ?? "Sin dato"}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-[18px] border border-blue-100 bg-blue-50/75 p-5">
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
          <div className="rounded-[18px] border border-slate-200 bg-white/90 px-4 py-4 text-sm text-slate-600">
            {medication.notes}
          </div>
        ) : null}

        <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white/95 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <Pill className="h-4 w-4 text-blue-700" />
            Solicitar nueva receta
          </div>
          <div className="space-y-2">
            <Label htmlFor={`note-${medication.patient_medication_id}`}>
              Observaciones para tu medico
            </Label>
            <Input
              id={`note-${medication.patient_medication_id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
              maxLength={200}
              className="border-slate-200 bg-slate-50 text-slate-900 shadow-none focus-visible:border-blue-500 focus-visible:ring-blue-500/12"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {medication.latest_request ? (
                <p>
                  Ultimo pedido:{" "}
                  {new Date(medication.latest_request.requested_at).toLocaleString("es-AR")}
                </p>
              ) : (
                <p>Aun no tenes pedidos cargados para este tratamiento.</p>
              )}
            </div>
            <Button
              className="bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)]"
              type="button"
              onClick={handleRequest}
              disabled={!medication.calculation.can_request_refill || isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Pedir mas"}
            </Button>
          </div>
          {medication.calculation.blocked_message ? (
            <p className="text-sm text-slate-600">
              {medication.calculation.blocked_message}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Ya podes solicitar una nueva receta para este tratamiento.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
