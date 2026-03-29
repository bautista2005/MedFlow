"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type {
  PatientCalendarLogStatus,
  PatientWeeklyCalendarDose,
  PatientWeeklyCalendarResponse,
} from "@/lib/calendar/types";
import { addDaysToIsoDate, getStartOfWeekIsoDate, getTodayIsoDate } from "@/lib/calendar/utils";
import {
  getPatientWeeklyCalendar,
  upsertPatientCalendarLog,
} from "@/services/patient/patient-service";
import { PatientWeeklyCalendarDayCard } from "@/components/mediya/patient/patient-weekly-calendar-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PatientWeeklyCalendarProps = {
  hasTreatments: boolean;
};

function buildCurrentWeekStart() {
  return getStartOfWeekIsoDate(getTodayIsoDate());
}

function formatWeekRange(calendar: PatientWeeklyCalendarResponse | null) {
  if (!calendar) {
    return "";
  }

  const start = new Date(`${calendar.week_start}T00:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const end = new Date(`${calendar.week_end}T00:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${start} - ${end}`;
}

function buildDoseKey(
  dose: Pick<
    PatientWeeklyCalendarDose,
    "weekly_schedule_config_id" | "scheduled_for_date" | "slot_key"
  >,
) {
  return `${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`;
}

function updateDoseInCalendar(
  currentCalendar: PatientWeeklyCalendarResponse | null,
  doseKey: string,
  updater: (dose: PatientWeeklyCalendarDose) => PatientWeeklyCalendarDose,
) {
  if (!currentCalendar) {
    return currentCalendar;
  }

  let didUpdate = false;

  const nextDays = currentCalendar.days.map((day) => {
    const nextDoses = day.doses.map((dose) => {
      if (buildDoseKey(dose) !== doseKey) {
        return dose;
      }

      didUpdate = true;
      return updater(dose);
    });

    return didUpdate ? { ...day, doses: nextDoses } : day;
  });

  return didUpdate ? { ...currentCalendar, days: nextDays } : currentCalendar;
}

function CalendarSkeleton() {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="w-[9.25rem] shrink-0 space-y-1 rounded-[14px] border border-slate-200 bg-white/85 p-2"
          >
            <div className="h-3 w-12 animate-pulse rounded-full bg-slate-200" />
            <div className="h-2.5 w-10 animate-pulse rounded-full bg-slate-100" />
            <div className="h-10 animate-pulse rounded-[10px] bg-slate-100" />
            <div className="h-10 animate-pulse rounded-[10px] bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatientWeeklyCalendar({
  hasTreatments,
}: PatientWeeklyCalendarProps) {
  const [weekStart, setWeekStart] = useState(buildCurrentWeekStart);
  const [calendar, setCalendar] = useState<PatientWeeklyCalendarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingDoseKey, setSavingDoseKey] = useState<string | null>(null);
  const [doseErrors, setDoseErrors] = useState<Record<string, string | null>>({});

  function updateWeek(nextWeekStart: string) {
    setIsLoading(true);
    setWeekStart(nextWeekStart);
  }

  useEffect(() => {
    let cancelled = false;

    void getPatientWeeklyCalendar(weekStart)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setCalendar(result);
        setErrorMessage(null);
        setDoseErrors({});
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el calendario.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  if (!hasTreatments) {
    return null;
  }

  async function handleDoseStatusChange(
    doseKey: string,
    status: PatientCalendarLogStatus,
  ) {
    const currentDose = calendar?.days
      .flatMap((day) => day.doses)
      .find((dose) => buildDoseKey(dose) === doseKey);

    if (!currentDose) {
      return;
    }

    const previousDose = { ...currentDose };
    const optimisticTimestamp = new Date().toISOString();

    setSavingDoseKey(doseKey);
    setDoseErrors((current) => ({ ...current, [doseKey]: null }));
    setCalendar((current) =>
      updateDoseInCalendar(current, doseKey, (dose) => ({
        ...dose,
        status,
        logged_at: optimisticTimestamp,
        taken_at: status === "missed" ? null : optimisticTimestamp,
      })),
    );

    try {
      const result = await upsertPatientCalendarLog({
        weekly_schedule_config_id: currentDose.weekly_schedule_config_id,
        patient_medication_id: currentDose.patient_medication_id,
        scheduled_for_date: currentDose.scheduled_for_date,
        slot_key: currentDose.slot_key,
        status,
      });

      setCalendar((current) =>
        updateDoseInCalendar(current, doseKey, (dose) => ({
          ...dose,
          status: result.log.status,
          log_id: result.log.weekly_schedule_log_id,
          logged_at: result.log.logged_at,
          taken_at: result.log.taken_at,
          note: result.log.note,
        })),
      );
    } catch (error) {
      setCalendar((current) => updateDoseInCalendar(current, doseKey, () => previousDose));
      setDoseErrors((current) => ({
        ...current,
        [doseKey]:
          error instanceof Error ? error.message : "No se pudo actualizar la toma.",
      }));
    } finally {
      setSavingDoseKey((current) => (current === doseKey ? null : current));
    }
  }

  return (
    <Card className="border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(240,253,250,0.98))] shadow-[0_18px_42px_rgba(16,185,129,0.08)]">
      <CardHeader className="space-y-2.5 pb-2">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <Badge className="w-fit border-emerald-200 bg-emerald-50 text-emerald-900">
              Calendario semanal
            </Badge>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-1.5 text-[1.2rem]">
                <CalendarDays className="h-4 w-4 text-emerald-700" />
                Seguimiento de tomas
              </CardTitle>
              <p className="max-w-2xl text-xs leading-4.5 text-slate-600">
                Marcá cada toma y revisá la semana activa.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:max-w-[26rem] lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateWeek(addDaysToIsoDate(weekStart, -7))}
              className="h-7 px-2.5 text-[11px]"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateWeek(buildCurrentWeekStart())}
              className="h-7 px-2.5 text-[11px]"
            >
              Semana actual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateWeek(addDaysToIsoDate(weekStart, 7))}
              className="h-7 px-2.5 text-[11px]"
            >
              Siguiente
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-[12px] border border-emerald-100 bg-white/80 px-3 py-1.5 text-xs text-slate-600">
          <span className="font-medium text-slate-900">Semana</span>
          {calendar ? ` · ${formatWeekRange(calendar)}` : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        {errorMessage ? (
          <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? <CalendarSkeleton /> : null}

        {!isLoading && calendar && !calendar.has_calendar ? (
          <div className="rounded-[20px] border border-dashed border-emerald-200 bg-white/80 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Todavía no tenés un calendario semanal activo
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Cuando tu médico configure días y tomas para alguno de tus tratamientos,
              vas a poder seguirlo desde este bloque.
            </p>
          </div>
        ) : null}

        {!isLoading && calendar && calendar.has_calendar ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {calendar.days.map((day) => (
                <PatientWeeklyCalendarDayCard
                  key={day.date}
                  day={day}
                  errorByDoseKey={doseErrors}
                  savingDoseKey={savingDoseKey}
                  onDoseStatusChange={handleDoseStatusChange}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
