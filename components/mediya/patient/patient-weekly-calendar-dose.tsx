"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, Clock3, XCircle } from "lucide-react";

import type { PatientCalendarLogStatus, PatientWeeklyCalendarDose } from "@/lib/calendar/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PatientWeeklyCalendarDoseProps = {
  dose: PatientWeeklyCalendarDose;
  doseKey: string;
  errorMessage: string | null;
  isSaving: boolean;
  onStatusChange: (doseKey: string, status: PatientCalendarLogStatus) => Promise<void>;
};

const statusUi = {
  pending: {
    label: "Pendiente",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    Icon: CircleDashed,
  },
  taken: {
    label: "Tomada",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    Icon: CheckCircle2,
  },
  taken_late: {
    label: "Tomada tarde",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: Clock3,
  },
  missed: {
    label: "Omitida",
    className: "border-rose-200 bg-rose-50 text-rose-900",
    Icon: XCircle,
  },
} as const;

function formatDoseMeta(dose: PatientWeeklyCalendarDose) {
  const fragments = [dose.dose_text];

  if (dose.units_per_intake !== null) {
    fragments.push(`${dose.units_per_intake} unidad${dose.units_per_intake === 1 ? "" : "es"}`);
  }

  return fragments.join(" · ");
}

function formatActionTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PatientWeeklyCalendarDoseItem({
  dose,
  doseKey,
  errorMessage,
  isSaving,
  onStatusChange,
}: PatientWeeklyCalendarDoseProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = statusUi[dose.status];
  const StatusIcon = status.Icon;
  const actionTimestamp = formatActionTimestamp(dose.taken_at ?? dose.logged_at);

  async function handleStatusChange(nextStatus: PatientCalendarLogStatus) {
    await onStatusChange(doseKey, nextStatus);
    setIsExpanded(false);
  }

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white/90 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{dose.medication_name}</p>
          <p className="text-xs text-slate-500">
            {dose.presentation ?? "Sin presentacion"} · {formatDoseMeta(dose)}
          </p>
        </div>
        <Badge className={status.className}>
          <StatusIcon className="mr-1 h-3.5 w-3.5" />
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium text-blue-900">
          {dose.slot_time ?? dose.slot_label ?? "Sin horario"}
        </span>
        {dose.slot_time && dose.slot_label ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            {dose.slot_label}
          </span>
        ) : null}
      </div>

      {actionTimestamp ? (
        <p className="mt-3 text-xs text-slate-500">
          {dose.status === "missed"
            ? `Marcada a las ${actionTimestamp}`
            : `Registrada a las ${actionTimestamp}`}
        </p>
      ) : null}

      {dose.note ? <p className="mt-3 text-xs leading-5 text-slate-500">{dose.note}</p> : null}

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            Adherencia
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isSaving ? "Guardando..." : isExpanded ? "Cerrar" : "Actualizar"}
          </Button>
        </div>

        {isExpanded ? (
          <div className="grid gap-2">
            <Button
              type="button"
              size="sm"
              className="justify-start bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isSaving}
              onClick={() => void handleStatusChange("taken")}
            >
              Lo tome
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-start border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={isSaving}
              onClick={() => void handleStatusChange("missed")}
            >
              No lo tome
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-start border-amber-200 text-amber-700 hover:bg-amber-50"
              disabled={isSaving}
              onClick={() => void handleStatusChange("taken_late")}
            >
              Lo tome fuera de horario
            </Button>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
