"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ArrowLeft } from "lucide-react";

import type { PatientDetail } from "@/lib/doctor/types";
import {
  getDoctorPatientDetail,
  uploadDoctorPrescriptionFile,
} from "@/services/doctor/doctor-service";
import { PatientWeeklyCalendarPanel } from "@/components/mediya/doctor/patient-weekly-calendar-panel";
import { PatientTreatmentForm } from "@/components/mediya/doctor/patient-treatment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PatientDetailPanelProps = {
  patientId: string;
};

const requestStatusLabel: Record<PatientDetail["requests"][number]["status"], string> = {
  pending: "Pendiente",
  reviewed: "En revisión",
  accepted: "Aceptado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

const requestStatusClassName: Record<PatientDetail["requests"][number]["status"], string> = {
  pending: "border-blue-200 bg-blue-600 text-white",
  reviewed: "border-blue-200 bg-blue-600 text-white",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rejected: "border-rose-200 bg-rose-50 text-rose-900",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
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

export function PatientDetailPanel({ patientId }: PatientDetailPanelProps) {
  const [data, setData] = useState<PatientDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [uploadingRequestId, setUploadingRequestId] = useState<number | null>(null);
  const fileInputPrefix = useId();

  async function refreshPatient() {
    try {
      const result = await getDoctorPatientDetail(patientId);
      setData(result);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el paciente.",
      );
    }
  }

  useEffect(() => {
    let isActive = true;

    void getDoctorPatientDetail(patientId)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setData(result);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el paciente.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [patientId]);

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR");
  }

  function formatIntervalHours(intakesPerDay: number | null) {
    if (!intakesPerDay || intakesPerDay <= 0) {
      return null;
    }

    const intervalHours = 24 / intakesPerDay;
    return Number.isInteger(intervalHours)
      ? intervalHours.toString()
      : intervalHours.toFixed(2);
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

  const pendingRequests =
    data?.requests.filter(
      (request) => request.status === "pending" || request.status === "reviewed",
    ) ?? [];
  const completedRequests =
    data?.requests.filter(
      (request) =>
        request.status === "accepted" ||
        request.status === "rejected" ||
        request.status === "cancelled",
    ) ?? [];

  async function handleRequestUpload(requestId: number, fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    setUploadingRequestId(requestId);
    setErrorMessage(null);

    try {
      await uploadDoctorPrescriptionFile(requestId, file);
      await refreshPatient();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir la receta.",
      );
    } finally {
      setUploadingRequestId(null);
    }
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Link
          href="/panel"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
          aria-label="Volver al panel"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Card className="border-white/70 bg-white/88">
          <CardContent className="pt-7 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          href="/panel"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
          aria-label="Volver al panel"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Card className="border-white/70 bg-white/88">
          <CardContent className="pt-7 text-sm text-muted-foreground">Cargando...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Link
        href="/panel"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
        aria-label="Volver al panel"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <Card className="border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]">
        <CardHeader>
          <Badge className="border-blue-200 bg-blue-50 text-blue-900">Paciente</Badge>
          <CardTitle className="font-sans text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-900">
            {data.name}
          </CardTitle>
          <CardDescription className="text-slate-500">
            DNI {data.dni} · {data.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p>Telefono: {data.phone || "Sin telefono"}</p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p>Zona: {data.zone || "Sin definir"}</p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p>Direccion: {data.address || "Sin direccion cargada"}</p>
          </div>
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p>Estado: {data.account_status}</p>
          </div>
          <p className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
            Farmacia preferida:{" "}
            {data.preferred_pharmacy ? data.preferred_pharmacy.name : "Sin preferencia"}
          </p>
        </CardContent>
      </Card>

      <PatientWeeklyCalendarPanel patientId={patientId} />

      <Card className="border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Badge className="border-blue-200 bg-blue-50 text-blue-900">Tratamientos</Badge>
              <div className="space-y-1">
                <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
                  Tratamientos
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Tratamientos registrados para este paciente.
                </CardDescription>
              </div>
            </div>
            <Button
              className="bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)]"
              variant={isFormVisible ? "outline" : "default"}
              onClick={() => setIsFormVisible((current) => !current)}
            >
              {isFormVisible ? "Ocultar formulario" : "Agregar tratamiento"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFormVisible ? (
            <PatientTreatmentForm
              patientId={patientId}
              onCreated={async () => {
                await refreshPatient();
              }}
              onCancel={() => setIsFormVisible(false)}
            />
          ) : null}
          {data.medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay medicacion registrada todavia.
            </p>
          ) : null}
          {data.medications.map((medication) => (
            <div
              key={medication.patient_medication_id}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-blue-900">{medication.medication_name}</p>
                {medication.weekly_schedule?.is_enabled ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">
                    Calendario semanal activo
                  </Badge>
                ) : (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                    Sin calendario semanal
                  </Badge>
                )}
              </div>
              <p>Dosis diaria: {medication.dose_text}</p>
              {formatIntervalHours(medication.intakes_per_day) ? (
                <p>Intervalo en hs: {formatIntervalHours(medication.intakes_per_day)}</p>
              ) : null}
              {medication.pills_per_box ? (
                <p>Cantidad de unidades por caja: {medication.pills_per_box}</p>
              ) : null}
              <p>Cantidad de unidades (cajas): {medication.box_count}</p>
              <p>Inicio: {formatDate(medication.start_date)}</p>
              {medication.weekly_schedule?.is_enabled ? (
                <div className="mt-4 rounded-[1rem] border border-emerald-100 bg-emerald-50/70 p-4 text-slate-700">
                  <p className="font-semibold text-emerald-900">Resumen del calendario</p>
                  <p>Dias: {formatScheduleDays(medication.weekly_schedule.days_of_week)}</p>
                  <p>Tomas por dia: {medication.weekly_schedule.intake_slots.length}</p>
                  <p>
                    Horarios:{" "}
                    {formatScheduleTimes(
                      medication.weekly_schedule.intake_slots.map((slot) => slot.time),
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]">
        <CardHeader>
          <Badge className="border-blue-200 bg-blue-50 text-blue-900">Pedidos</Badge>
          <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
            Pedidos
          </CardTitle>
          <CardDescription className="text-slate-500">
            Historial de solicitudes de receta y archivos asociados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Pedidos pendientes</h3>
              <Badge className="border-blue-200 bg-blue-600 text-white">
                {pendingRequests.length}
              </Badge>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pedidos pendientes para este paciente.
              </p>
            ) : null}
            {pendingRequests.map((request) => (
              <div
                key={request.prescription_request_id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-blue-900">{request.medication_name}</p>
                  <Badge className={requestStatusClassName[request.status]}>
                    {requestStatusLabel[request.status]}
                  </Badge>
                </div>
                <p>Pedido: {new Date(request.requested_at).toLocaleString("es-AR")}</p>
                {request.current_file ? (
                  <p>Archivo actual: {request.current_file.original_filename}</p>
                ) : (
                  <p>Sin receta adjunta.</p>
                )}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id={`${fileInputPrefix}-${request.prescription_request_id}`}
                    type="file"
                    accept="image/png,application/pdf"
                    className="sr-only"
                    onChange={(event) =>
                      handleRequestUpload(request.prescription_request_id, event.target.files)
                    }
                    disabled={uploadingRequestId === request.prescription_request_id}
                  />
                  {uploadingRequestId === request.prescription_request_id ||
                  Boolean(request.current_file) ? (
                    <span className="inline-flex h-9 w-full items-center justify-center rounded-md bg-slate-200 px-4 text-sm font-medium text-slate-500 sm:w-auto">
                      {uploadingRequestId === request.prescription_request_id
                        ? "Procesando..."
                        : "Adjuntar receta"}
                    </span>
                  ) : (
                    <label
                      htmlFor={`${fileInputPrefix}-${request.prescription_request_id}`}
                      className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:w-auto"
                    >
                      Adjuntar receta
                    </label>
                  )}
                  <p className="text-xs text-slate-500">
                    Adjuntá una receta en PNG o PDF para simular si la farmacia la acepta o la
                    rechaza.
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Pedidos completos</h3>
              <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                {completedRequests.length}
              </Badge>
            </div>
            {completedRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pedidos completos para este paciente.
              </p>
            ) : null}
            {completedRequests.map((request) => (
              <div
                key={request.prescription_request_id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{request.medication_name}</p>
                  <Badge className={requestStatusClassName[request.status]}>
                    {requestStatusLabel[request.status]}
                  </Badge>
                </div>
                <p>Pedido: {new Date(request.requested_at).toLocaleString("es-AR")}</p>
                {request.current_file ? (
                  <p>Archivo actual: {request.current_file.original_filename}</p>
                ) : (
                  <p>Sin receta adjunta.</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
