"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type {
  DoctorWeeklyCalendarMedication,
  DoctorWeeklyCalendarResponse,
  PatientWeeklyCalendarDose,
  WeeklyCalendarStatusSummary,
} from "@/lib/calendar/types";
import { addDaysToIsoDate, getStartOfWeekIsoDate, getTodayIsoDate } from "@/lib/calendar/utils";
import { getDoctorPatientWeeklyCalendar } from "@/services/doctor/doctor-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PatientWeeklyCalendarPanelProps = {
  patientId: string;
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
};

const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const STATUS_LABELS: Record<PatientWeeklyCalendarDose["status"], string> = {
  pending: "Pendiente",
  taken: "Tomada",
  taken_late: "Tomada tarde",
  missed: "Omitida",
};

const STATUS_CLASSNAMES: Record<PatientWeeklyCalendarDose["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  taken: "border-emerald-200 bg-emerald-50 text-emerald-900",
  taken_late: "border-blue-200 bg-blue-50 text-blue-900",
  missed: "border-rose-200 bg-rose-50 text-rose-900",
};

function buildCurrentWeekStart() {
  return getStartOfWeekIsoDate(getTodayIsoDate());
}

function formatWeekRange(calendar: DoctorWeeklyCalendarResponse | null) {
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

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatScheduleDays(daysOfWeek: number[]) {
  if (daysOfWeek.length === 0) {
    return "Sin dias configurados";
  }

  return WEEKDAY_DISPLAY_ORDER.filter((day) => daysOfWeek.includes(day))
    .map((day) => WEEKDAY_LABELS[day] ?? `Dia ${day}`)
    .join(", ");
}

function formatScheduleTimes(times: Array<string | null>) {
  const filteredTimes = times.filter((time): time is string => Boolean(time));

  if (filteredTimes.length === 0) {
    return "Sin horarios cargados";
  }

  return filteredTimes.join(", ");
}

function SummaryPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-[1rem] border px-3 py-2 text-sm ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white/85 p-5"
        >
          <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-48 animate-pulse rounded-full bg-slate-100" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((__, cardIndex) => (
              <div
                key={cardIndex}
                className="h-16 animate-pulse rounded-[1rem] bg-slate-100"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MedicationSummary({
  medication,
}: {
  medication: DoctorWeeklyCalendarMedication;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryPill
        label="Programadas"
        value={medication.summary.scheduled}
        className="border-slate-200 bg-slate-50 text-slate-900"
      />
      <SummaryPill
        label="Tomadas"
        value={medication.summary.taken + medication.summary.taken_late}
        className="border-emerald-200 bg-emerald-50 text-emerald-900"
      />
      <SummaryPill
        label="Omitidas"
        value={medication.summary.missed}
        className="border-rose-200 bg-rose-50 text-rose-900"
      />
      <SummaryPill
        label="Pendientes"
        value={medication.summary.pending}
        className="border-amber-200 bg-amber-50 text-amber-900"
      />
    </div>
  );
}

function WeeklySummary({ summary }: { summary: WeeklyCalendarStatusSummary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <SummaryPill
        label="Programadas"
        value={summary.scheduled}
        className="border-slate-200 bg-white text-slate-900"
      />
      <SummaryPill
        label="Tomadas"
        value={summary.taken}
        className="border-emerald-200 bg-emerald-50 text-emerald-900"
      />
      <SummaryPill
        label="Tarde"
        value={summary.taken_late}
        className="border-blue-200 bg-blue-50 text-blue-900"
      />
      <SummaryPill
        label="Omitidas"
        value={summary.missed}
        className="border-rose-200 bg-rose-50 text-rose-900"
      />
      <SummaryPill
        label="Pendientes"
        value={summary.pending}
        className="border-amber-200 bg-amber-50 text-amber-900"
      />
    </div>
  );
}

function DoseRow({ dose }: { dose: PatientWeeklyCalendarDose }) {
  return (
    <div className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-900">
          {dose.slot_label || dose.slot_time || "Toma programada"}
        </p>
        <Badge className={STATUS_CLASSNAMES[dose.status]}>{STATUS_LABELS[dose.status]}</Badge>
      </div>
      <p className="mt-2">{dose.dose_text}</p>
      {dose.slot_time ? <p className="mt-1 text-xs text-slate-500">Horario: {dose.slot_time}</p> : null}
      {dose.taken_at ? (
        <p className="mt-1 text-xs text-slate-500">
          Registrada: {new Date(dose.taken_at).toLocaleString("es-AR")}
        </p>
      ) : null}
    </div>
  );
}

function MedicationCalendar({ medication }: { medication: DoctorWeeklyCalendarMedication }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{medication.medication_name}</p>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">
                Calendario activo
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              {medication.dose_text} · {medication.frequency_text}
            </p>
          </div>
          <div className="rounded-[1rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700">
            <p>Dias: {formatScheduleDays(medication.schedule.days_of_week)}</p>
            <p>
              Horarios:{" "}
              {formatScheduleTimes(medication.schedule.intake_slots.map((slot) => slot.time))}
            </p>
            <p>
              Vigencia: {formatDate(medication.schedule.schedule_start_date)}
              {medication.schedule.schedule_end_date
                ? ` al ${formatDate(medication.schedule.schedule_end_date)}`
                : " en adelante"}
            </p>
          </div>
        </div>

        <MedicationSummary medication={medication} />

        <div className="grid gap-3 xl:grid-cols-7">
          {medication.days.map((day) => (
            <div
              key={`${medication.patient_medication_id}-${day.date}`}
              className={`space-y-3 rounded-[1.2rem] border px-4 py-4 ${
                day.is_today
                  ? "border-emerald-200 bg-emerald-50/80"
                  : "border-slate-200 bg-slate-50/80"
              }`}
            >
              <div>
                <p className="font-semibold text-slate-900">{day.label}</p>
                <p className="text-xs text-slate-500">{WEEKDAY_LABELS[day.weekday]}</p>
              </div>
              {day.doses.length === 0 ? (
                <p className="text-xs text-slate-500">Sin tomas programadas.</p>
              ) : (
                <div className="space-y-2">
                  {day.doses.map((dose) => (
                    <DoseRow
                      key={`${dose.weekly_schedule_config_id}-${dose.scheduled_for_date}-${dose.slot_key}`}
                      dose={dose}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PatientWeeklyCalendarPanel({
  patientId,
}: PatientWeeklyCalendarPanelProps) {
  const [weekStart, setWeekStart] = useState(buildCurrentWeekStart);
  const [calendar, setCalendar] = useState<DoctorWeeklyCalendarResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);

    void getDoctorPatientWeeklyCalendar(patientId, weekStart)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setCalendar(result);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el calendario del paciente.",
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
  }, [patientId, weekStart]);

  return (
    <Card className="border-emerald-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(240,253,250,0.98))] shadow-[0_24px_60px_rgba(16,185,129,0.08)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">
              Calendario semanal
            </Badge>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[1.7rem]">
                <CalendarDays className="h-5 w-5 text-emerald-700" />
                Adherencia por tratamiento
              </CardTitle>
              <CardDescription>
                Vista de solo lectura del calendario semanal y del estado de cada toma.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDaysToIsoDate(weekStart, -7))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(buildCurrentWeekStart())}
            >
              Semana actual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDaysToIsoDate(weekStart, 7))}
            >
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-[16px] border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Semana</span>
          {calendar ? ` · ${formatWeekRange(calendar)}` : null}
        </div>

        {calendar ? <WeeklySummary summary={calendar.summary} /> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? <CalendarSkeleton /> : null}

        {!isLoading && calendar && !calendar.has_treatments ? (
          <div className="rounded-[20px] border border-dashed border-emerald-200 bg-white/80 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Este paciente no tiene tratamientos activos
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Agregá un tratamiento para empezar a seguir tomas y adherencia semanal.
            </p>
          </div>
        ) : null}

        {!isLoading && calendar && calendar.has_treatments && !calendar.has_schedule ? (
          <div className="rounded-[20px] border border-dashed border-emerald-200 bg-white/80 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Los tratamientos activos todavía no usan calendario semanal
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              El paciente tiene medicación activa, pero ninguna fue configurada con dias y tomas
              semanales.
            </p>
          </div>
        ) : null}

        {!isLoading &&
        calendar &&
        calendar.has_treatments &&
        calendar.has_schedule &&
        !calendar.has_calendar ? (
          <div className="rounded-[20px] border border-dashed border-emerald-200 bg-white/80 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              No hay tomas para la semana seleccionada
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Hay calendarios activos, pero no generan ocurrencias en este rango de fechas.
            </p>
          </div>
        ) : null}

        {!isLoading && calendar && calendar.has_calendar ? (
          <div className="space-y-4">
            {calendar.medications.map((medication) => (
              <MedicationCalendar
                key={medication.patient_medication_id}
                medication={medication}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
