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
    <div className="min-w-0 rounded-[10px] border border-slate-200 bg-white/90 p-1.5 shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-[11px] font-semibold leading-3.5 text-slate-900" title={dose.medication_name}>
            {dose.medication_name}
          </p>
          <p
            className="truncate text-[9px] leading-3 text-slate-500"
            title={`${dose.presentation ?? "Sin presentacion"} · ${formatDoseMeta(dose)}`}
          >
            {dose.presentation ?? "Sin presentacion"} · {formatDoseMeta(dose)}
          </p>
        </div>
        <Badge className={`shrink-0 px-1 py-0 text-[9px] ${status.className}`}>
          <StatusIcon className="mr-0.5 h-2 w-2" />
          <span className="truncate">{status.label}</span>
        </Badge>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-slate-600">
        <span className="rounded-full border border-blue-100 bg-blue-50 px-1 py-0 font-medium text-blue-900">
          {dose.slot_time ?? dose.slot_label ?? "Sin horario"}
        </span>
        {dose.slot_time && dose.slot_label ? (
          <span className="truncate rounded-full border border-slate-200 bg-slate-50 px-1 py-0">
            {dose.slot_label}
          </span>
        ) : null}
        {actionTimestamp ? (
          <span className="text-[9px] text-slate-400">
            {dose.status === "missed" ? `Marcada ${actionTimestamp}` : `OK ${actionTimestamp}`}
          </span>
        ) : null}
      </div>

      <div className="mt-1 space-y-1">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => setIsExpanded((current) => !current)}
            className="h-5 rounded-[8px] px-1.5 text-[9px]"
          >
            {isSaving ? "Guardando..." : isExpanded ? "Cerrar" : "Marcar"}
          </Button>
        </div>

        {isExpanded ? (
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              className="h-6 rounded-[8px] bg-emerald-600 px-1.5 text-[9px] text-white hover:bg-emerald-700"
              disabled={isSaving}
              onClick={() => void handleStatusChange("taken")}
            >
              Lo tome
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 rounded-[8px] border-rose-200 px-1.5 text-[9px] text-rose-700 hover:bg-rose-50"
              disabled={isSaving}
              onClick={() => void handleStatusChange("missed")}
            >
              No lo tome
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="col-span-2 h-6 rounded-[8px] border-amber-200 px-1.5 text-[9px] text-amber-700 hover:bg-amber-50"
              disabled={isSaving}
              onClick={() => void handleStatusChange("taken_late")}
            >
              Lo tome fuera de horario
            </Button>
          </div>
        ) : null}

        {dose.note && isExpanded ? (
          <p className="text-[9px] leading-3 text-slate-500">{dose.note}</p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-[8px] border border-red-200 bg-red-50 px-1.5 py-1 text-[9px] leading-3 text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
