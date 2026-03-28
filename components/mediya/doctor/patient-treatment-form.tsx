"use client";

import { useEffect, useState } from "react";

import type { CreatePatientTreatmentPayload } from "@/lib/doctor/types";
import { createDoctorPatientTreatment } from "@/services/doctor/doctor-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PatientTreatmentFormProps = {
  patientId: string;
  onCreated: () => Promise<void>;
  onCancel: () => void;
};

type ScheduleSlotDraft = {
  label: string;
  time: string;
};

type WeeklyScheduleDraft = {
  days_of_week: number[];
  times_per_day: number;
  intake_slots: ScheduleSlotDraft[];
  notes: string;
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
] as const;

const emptyForm: CreatePatientTreatmentPayload = {
  medication_name: "",
  daily_dose: 1,
  interval_hours: 24,
  pills_per_box: 1,
  box_count: 1,
  start_date: "",
};

function buildScheduleSlots(timesPerDay: number, currentSlots: ScheduleSlotDraft[]) {
  return Array.from({ length: timesPerDay }, (_, index) => ({
    label: currentSlots[index]?.label ?? "",
    time: currentSlots[index]?.time ?? "",
  }));
}

function getExpectedTimesPerDay(intervalHours: number) {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
    return null;
  }

  const expectedTimesPerDay = 24 / intervalHours;

  if (!Number.isInteger(expectedTimesPerDay) || expectedTimesPerDay <= 0) {
    return null;
  }

  return expectedTimesPerDay;
}

function createEmptySchedule(intervalHours: number): WeeklyScheduleDraft {
  const expectedTimesPerDay = getExpectedTimesPerDay(intervalHours) ?? 1;

  return {
    days_of_week: [],
    times_per_day: expectedTimesPerDay,
    intake_slots: buildScheduleSlots(expectedTimesPerDay, []),
    notes: "",
  };
}

export function PatientTreatmentForm({
  patientId,
  onCreated,
  onCancel,
}: PatientTreatmentFormProps) {
  const [form, setForm] = useState<CreatePatientTreatmentPayload>(emptyForm);
  const [weeklyScheduleEnabled, setWeeklyScheduleEnabled] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDraft>(
    createEmptySchedule(emptyForm.interval_hours),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const expectedTimesPerDay = getExpectedTimesPerDay(Number(form.interval_hours));

  useEffect(() => {
    if (!weeklyScheduleEnabled || expectedTimesPerDay === null) {
      return;
    }

    setWeeklySchedule((current) => ({
      ...current,
      times_per_day: expectedTimesPerDay,
      intake_slots: buildScheduleSlots(expectedTimesPerDay, current.intake_slots),
    }));
  }, [expectedTimesPerDay, weeklyScheduleEnabled]);

  function resetForm() {
    setForm(emptyForm);
    setWeeklyScheduleEnabled(false);
    setWeeklySchedule(createEmptySchedule(emptyForm.interval_hours));
  }

  function updateField<K extends keyof CreatePatientTreatmentPayload>(
    field: K,
    value: CreatePatientTreatmentPayload[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateSchedule(
    updater:
      | WeeklyScheduleDraft
      | ((current: WeeklyScheduleDraft) => WeeklyScheduleDraft),
  ) {
    setWeeklySchedule(updater);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function toggleWeekday(day: number) {
    updateSchedule((current) => {
      const isSelected = current.days_of_week.includes(day);
      const nextDays = isSelected
        ? current.days_of_week.filter((currentDay) => currentDay !== day)
        : [...current.days_of_week, day];

      return {
        ...current,
        days_of_week: nextDays,
      };
    });
  }

  function handleTimesPerDayChange(rawValue: string) {
    const nextValue = Number(rawValue || 0);

    updateSchedule((current) => {
      const safeValue = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1;

      return {
        ...current,
        times_per_day: safeValue,
        intake_slots: buildScheduleSlots(safeValue, current.intake_slots),
      };
    });
  }

  function updateSlot(
    index: number,
    field: keyof ScheduleSlotDraft,
    value: string,
  ) {
    updateSchedule((current) => ({
      ...current,
      intake_slots: current.intake_slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [field]: value } : slot,
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: CreatePatientTreatmentPayload = {
        medication_name: form.medication_name.trim(),
        daily_dose: Number(form.daily_dose),
        interval_hours: Number(form.interval_hours),
        pills_per_box: Number(form.pills_per_box),
        box_count: Number(form.box_count),
        start_date: form.start_date,
      };

      if (weeklyScheduleEnabled) {
        payload.weekly_schedule = {
          is_enabled: true,
          days_of_week: weeklySchedule.days_of_week,
          intake_slots: weeklySchedule.intake_slots.map((slot, index) => ({
            slot_key: `slot_${index + 1}`,
            label: slot.label.trim() || null,
            time: slot.time.trim() || null,
          })),
          notes: weeklySchedule.notes.trim() || null,
        };
      }

      const result = await createDoctorPatientTreatment(patientId, payload);
      await onCreated();
      resetForm();
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear el tratamiento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-[18px] border border-slate-200 bg-slate-50/70 p-5"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="medication_name">Medicamento</Label>
          <Input
            id="medication_name"
            value={form.medication_name}
            onChange={(event) => updateField("medication_name", event.target.value)}
            placeholder="Isotretinoina 20mg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daily_dose">Dosis diaria</Label>
          <Input
            type="number"
            id="daily_dose"
            min="0.01"
            step="0.01"
            value={form.daily_dose}
            onChange={(event) =>
              updateField("daily_dose", Number(event.target.value || 0))
            }
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interval_hours">Intervalo en hs</Label>
          <Input
            type="number"
            id="interval_hours"
            min="1"
            step="1"
            value={form.interval_hours}
            onChange={(event) =>
              updateField("interval_hours", Number(event.target.value || 0))
            }
            placeholder="8"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pills_per_box">Cantidad de unidades por caja</Label>
          <Input
            id="pills_per_box"
            type="number"
            min="1"
            step="1"
            value={form.pills_per_box}
            onChange={(event) =>
              updateField("pills_per_box", Number(event.target.value || 0))
            }
            placeholder="30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="box_count">Cantidad de unidades (cajas)</Label>
          <Input
            id="box_count"
            type="number"
            min="1"
            step="1"
            value={form.box_count}
            onChange={(event) =>
              updateField("box_count", Number(event.target.value || 0))
            }
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(event) => updateField("start_date", event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-[18px] border border-blue-100 bg-white/90 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={weeklyScheduleEnabled}
            onChange={(event) => {
              const isEnabled = event.target.checked;
              setWeeklyScheduleEnabled(isEnabled);
              setErrorMessage(null);
              setSuccessMessage(null);

              if (isEnabled) {
                setWeeklySchedule(createEmptySchedule(Number(form.interval_hours)));
              }
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Agregar este tratamiento al calendario semanal
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Configura dias y tomas semanales para que el paciente vea el esquema desde su
              dashboard.
            </p>
          </div>
        </label>

        {weeklyScheduleEnabled ? (
          <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Dias del calendario</Label>
                <p className="text-xs text-slate-500">
                  Selecciona los dias en los que aplica el tratamiento.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const isSelected = weeklySchedule.days_of_week.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]"
                          : "border-slate-200 bg-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800",
                      )}
                      onClick={() => toggleWeekday(day.value)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
              <div className="space-y-2">
                <Label htmlFor="times_per_day">Tomas por dia</Label>
                <Input
                  id="times_per_day"
                  type="number"
                  min="1"
                  step="1"
                  value={weeklySchedule.times_per_day}
                  onChange={(event) => handleTimesPerDayChange(event.target.value)}
                />
                <p className="text-xs leading-5 text-slate-500">
                  {expectedTimesPerDay === null
                    ? "El intervalo actual no divide 24 hs en tomas enteras, por lo que el calendario no va a validar."
                    : `Segun el intervalo, este tratamiento debe tener ${expectedTimesPerDay} toma(s) por dia.`}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Franjas de toma</Label>
                  <p className="text-xs text-slate-500">
                    Carga una etiqueta opcional y un horario en formato 24 hs.
                  </p>
                </div>

                <div className="space-y-3">
                  {weeklySchedule.intake_slots.map((slot, index) => (
                    <div
                      key={`slot-${index + 1}`}
                      className="grid gap-3 rounded-[16px] border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_160px]"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`slot-label-${index + 1}`}>Etiqueta toma {index + 1}</Label>
                        <Input
                          id={`slot-label-${index + 1}`}
                          value={slot.label}
                          onChange={(event) =>
                            updateSlot(index, "label", event.target.value)
                          }
                          placeholder={`Toma ${index + 1}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`slot-time-${index + 1}`}>Horario</Label>
                        <Input
                          id={`slot-time-${index + 1}`}
                          type="time"
                          value={slot.time}
                          onChange={(event) =>
                            updateSlot(index, "time", event.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekly_schedule_notes">Notas del calendario</Label>
              <textarea
                id="weekly_schedule_notes"
                value={weeklySchedule.notes}
                onChange={(event) =>
                  updateSchedule((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Indicaciones adicionales para el paciente."
                className="flex min-h-[96px] w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar tratamiento"}
        </Button>
      </div>
    </form>
  );
}
