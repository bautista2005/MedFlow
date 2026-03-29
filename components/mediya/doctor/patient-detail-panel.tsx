"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCheck, Send } from "lucide-react";

import type { PatientDetail } from "@/lib/doctor/types";
import {
  getDoctorPatientDetail,
  sendDoctorPatientNotification,
  updateDoctorAlertStatus,
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
  prescription_uploaded: "Receta cargada",
  pharmacy_checking: "Consultando farmacia",
  no_stock_preferred: "Sin stock",
  awaiting_alternative_pharmacy: "Esperando farmacia alternativa",
  ready_for_pickup: "Listo para retirar",
  cancelled: "Cancelado",
};

const requestStatusClassName: Record<PatientDetail["requests"][number]["status"], string> = {
  pending: "border-blue-200 bg-blue-600 text-white",
  reviewed: "border-blue-200 bg-blue-600 text-white",
  prescription_uploaded: "border-violet-200 bg-violet-50 text-violet-900",
  pharmacy_checking: "border-amber-200 bg-amber-50 text-amber-900",
  no_stock_preferred: "border-rose-200 bg-rose-50 text-rose-900",
  awaiting_alternative_pharmacy: "border-amber-200 bg-amber-50 text-amber-900",
  ready_for_pickup: "border-emerald-200 bg-emerald-50 text-emerald-900",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
};

const riskLabels = {
  normal: "Normal",
  warning: "En seguimiento",
  critical: "Requiere atencion",
} as const;

const riskClassNames = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

function requiresDoctorAction(status: PatientDetail["requests"][number]["status"]) {
  return status === "pending" || status === "reviewed";
}

export function PatientDetailPanel({ patientId }: PatientDetailPanelProps) {
  const [data, setData] = useState<PatientDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [uploadingRequestId, setUploadingRequestId] = useState<number | null>(null);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [isSendingDoctorMessage, setIsSendingDoctorMessage] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);
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

  const refreshPatientWithFeedback = useEffectEvent(async () => {
    await refreshPatient();
  });

  useEffect(() => {
    void refreshPatientWithFeedback();

    const intervalId = window.setInterval(() => {
      void refreshPatientWithFeedback();
    }, 15000);

    const handleWindowFocus = () => {
      void refreshPatientWithFeedback();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshPatientWithFeedback();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const patientRequests = (data?.requests ?? []).filter((request) =>
    requiresDoctorAction(request.status),
  );
  const followUpNotificationCount = data?.follow_up_notification_count ?? 0;

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

  async function handleSendDoctorMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!doctorMessage.trim()) {
      setErrorMessage("Ingresa un mensaje para el paciente.");
      return;
    }

    setIsSendingDoctorMessage(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await sendDoctorPatientNotification(patientId, {
        message: doctorMessage.trim(),
        type: "doctor_follow_up_requested",
      });
      setDoctorMessage("");
      setSuccessMessage("Notificacion enviada al paciente.");
      await refreshPatient();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo enviar la notificacion.",
      );
    } finally {
      setIsSendingDoctorMessage(false);
    }
  }

  async function handleAlertStatusChange(alertId: number, status: "acknowledged" | "closed") {
    setUpdatingAlertId(alertId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateDoctorAlertStatus(alertId, { status });
      setSuccessMessage(
        status === "acknowledged"
          ? "Alerta marcada como revisada."
          : "Alerta cerrada correctamente.",
      );
      await refreshPatient();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la alerta.",
      );
    } finally {
      setUpdatingAlertId(null);
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

      <Card
        className={
          followUpNotificationCount > 0
            ? "relative border border-blue-300 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.98))] ring-1 ring-blue-200/70 shadow-[0_28px_100px_rgba(37,99,235,0.12)]"
            : "border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]"
        }
      >
        {followUpNotificationCount > 0 ? (
          <span className="absolute right-5 top-5 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-600 px-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]">
            {followUpNotificationCount}
          </span>
        ) : null}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">Paciente</Badge>
            {data.risk_status ? (
              <Badge className={riskClassNames[data.risk_status]}>{riskLabels[data.risk_status]}</Badge>
            ) : null}
            {followUpNotificationCount > 0 ? (
              <Badge className="border-blue-200 bg-blue-600 text-white">
                Seguimiento pendiente
              </Badge>
            ) : null}
          </div>
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
          {followUpNotificationCount > 0 ? (
            <p className="rounded-[1.2rem] border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 md:col-span-2">
              Este paciente tiene {followUpNotificationCount} alerta
              {followUpNotificationCount === 1 ? "" : "s"} de seguimiento del chatbot todavia
              visible{followUpNotificationCount === 1 ? "" : "s"} para el medico.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <Card className="border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
              Pedidos
            </CardTitle>
            <Badge className="border-blue-200 bg-blue-600 text-white">
              {patientRequests.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {patientRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay pedidos para este paciente.
            </p>
          ) : null}
          {patientRequests.map((request) => (
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
              {request.resolved_at ? (
                <p>Actualizado: {new Date(request.resolved_at).toLocaleString("es-AR")}</p>
              ) : null}
              {request.assigned_pharmacy ? (
                <p>Farmacia actual: {request.assigned_pharmacy.name}</p>
              ) : null}
              {request.current_file ? (
                <p>Archivo actual: {request.current_file.original_filename}</p>
              ) : (
                <p>Sin receta adjunta.</p>
              )}
              {requiresDoctorAction(request.status) ? (
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
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

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
                setIsFormVisible(false);
                setSuccessMessage("Tratamiento agregado correctamente.");
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
            </div>
          ))}
        </CardContent>
      </Card>

      <PatientWeeklyCalendarPanel patientId={patientId} />

      <Card className="border-blue-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,251,255,0.95))] shadow-[0_28px_100px_rgba(37,99,235,0.08)]">
        <CardHeader>
          <Badge className="border-amber-200 bg-amber-50 text-amber-900">Riesgo y alertas</Badge>
          <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
            Seguimiento clinico
          </CardTitle>
          <CardDescription className="text-slate-500">
            Estado agregado del chatbot, adherencia y eventos recientes del paciente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Estado actual
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {data.risk_status ? (
                  <Badge className={riskClassNames[data.risk_status]}>{riskLabels[data.risk_status]}</Badge>
                ) : (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">Sin datos</Badge>
                )}
                {typeof data.risk_score === "number" ? (
                  <span className="text-sm text-slate-500">
                    Score {(data.risk_score * 100).toFixed(0)}%
                  </span>
                ) : null}
              </div>
              {data.last_alert_at ? (
                <p className="mt-3 text-sm text-slate-500">
                  Ultima alerta: {new Date(data.last_alert_at).toLocaleString("es-AR")}
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Todavia no hay alertas recientes registradas.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {data.recent_alerts.length === 0 ? (
                <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  No hay alertas abiertas o recientes para este paciente.
                </div>
              ) : null}
              {data.recent_alerts.map((alert) => (
                <div
                  key={alert.doctor_patient_alert_id}
                  className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        alert.severity === "critical"
                          ? "border-rose-200 bg-rose-50 text-rose-900"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                      }
                    >
                      {alert.severity === "critical" ? "Critica" : "Warning"}
                    </Badge>
                    <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                      {alert.status}
                    </Badge>
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{alert.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {new Date(alert.created_at).toLocaleString("es-AR")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {alert.status === "open" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleAlertStatusChange(alert.doctor_patient_alert_id, "acknowledged")
                        }
                        disabled={updatingAlertId === alert.doctor_patient_alert_id}
                      >
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Revisada
                      </Button>
                    ) : null}
                    {alert.status !== "closed" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleAlertStatusChange(alert.doctor_patient_alert_id, "closed")
                        }
                        disabled={updatingAlertId === alert.doctor_patient_alert_id}
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Cerrar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSendDoctorMessage}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Mensaje al paciente
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              Enviar seguimiento manual
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El mensaje se registra en el inbox actual del paciente y aparece en notificaciones.
            </p>
            <textarea
              value={doctorMessage}
              onChange={(event) => setDoctorMessage(event.target.value)}
              placeholder="Ej. Quiero que me cuentes si los sintomas siguieron durante las proximas 24 horas."
              rows={6}
              className="mt-4 w-full resize-none rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            <Button type="submit" className="mt-4 w-full" disabled={isSendingDoctorMessage}>
              <Send className="mr-2 h-4 w-4" />
              {isSendingDoctorMessage ? "Enviando..." : "Enviar notificacion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
