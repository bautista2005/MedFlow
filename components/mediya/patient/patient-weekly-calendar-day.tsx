"use client";

import type { PatientCalendarLogStatus, PatientWeeklyCalendarDay } from "@/lib/calendar/types";
import { Badge } from "@/components/ui/badge";
import { PatientWeeklyCalendarDoseItem } from "@/components/mediya/patient/patient-weekly-calendar-dose";

type PatientWeeklyCalendarDayProps = {
  day: PatientWeeklyCalendarDay;
  errorByDoseKey: Record<string, string | null>;
  savingDoseKey: string | null;
  onDoseStatusChange: (
    doseKey: string,
    status: PatientCalendarLogStatus,
  ) => Promise<void>;
};

export function PatientWeeklyCalendarDayCard({
  day,
  errorByDoseKey,
  savingDoseKey,
  onDoseStatusChange,
}: PatientWeeklyCalendarDayProps) {
  return (
    <div className="rounded-[20px] border border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(245,249,255,0.98))] p-4 shadow-[0_18px_36px_rgba(37,99,235,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{day.label}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            {day.doses.length} toma{day.doses.length === 1 ? "" : "s"}
          </p>
        </div>
        {day.is_today ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">Hoy</Badge>
        ) : null}
      </div>

      {day.doses.length > 0 ? (
        <div className="space-y-3">
          {day.doses.map((dose) => (
            <PatientWeeklyCalendarDoseItem
              key={`${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`}
              dose={dose}
              doseKey={`${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`}
              errorMessage={
                errorByDoseKey[
                  `${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`
                ] ?? null
              }
              isSaving={
                savingDoseKey ===
                `${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`
              }
              onStatusChange={onDoseStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[16px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center text-sm text-slate-500">
          Sin tomas programadas.
        </div>
      )}
    </div>
  );
}
