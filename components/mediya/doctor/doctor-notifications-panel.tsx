"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCheck, ClipboardList, X } from "lucide-react";

import type { DoctorAlertsResponse, DoctorRequestsResponse } from "@/lib/doctor/types";
import { updateDoctorAlertStatus } from "@/services/doctor/doctor-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function requiresDoctorAction(status: DoctorRequestsResponse["requests"][number]["status"]) {
  return status === "pending" || status === "reviewed";
}

const requestStatusLabels: Record<DoctorRequestsResponse["requests"][number]["status"], string> = {
  pending: "Pendiente",
  reviewed: "En revisión",
  prescription_uploaded: "Receta cargada",
  pharmacy_checking: "Consultando farmacia",
  no_stock_preferred: "Sin stock",
  awaiting_alternative_pharmacy: "Esperando farmacia alternativa",
  ready_for_pickup: "Listo para retirar",
  cancelled: "Cancelado",
};

type NotificationEntry =
  | {
      kind: "alert";
      id: string;
      rawId: number;
      occurredAt: string;
      patientId: number;
      href: string;
      title: string;
      message: string;
      patientName: string;
      tone: "critical" | "warning";
      badge: string;
      stateLabel: string;
    }
  | {
      kind: "request";
      id: string;
      rawId: number;
      occurredAt: string;
      patientId: number;
      href: string;
      title: string;
      message: string;
      patientName: string;
      tone: "info";
      badge: string;
      stateLabel: string;
    };

type DoctorNotificationsPanelProps = {
  alerts: DoctorAlertsResponse["alerts"];
  requests: DoctorRequestsResponse["requests"];
  onAlertClosed: (alertId: number) => void;
  onRequestDismissed: (requestId: number) => void;
  onClose?: () => void;
};

export function DoctorNotificationsPanel({
  alerts,
  requests,
  onAlertClosed,
  onRequestDismissed,
  onClose,
}: DoctorNotificationsPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);

  const actionableRequests = useMemo(
    () => requests.filter((request) => requiresDoctorAction(request.status)),
    [requests],
  );
  const openAlerts = useMemo(() => alerts.filter((alert) => alert.status !== "closed"), [alerts]);
  const criticalAlerts = useMemo(
    () => openAlerts.filter((alert) => alert.severity === "critical"),
    [openAlerts],
  );
  const warningAlerts = useMemo(
    () => openAlerts.filter((alert) => alert.severity === "warning"),
    [openAlerts],
  );
  const notificationEntries = useMemo<NotificationEntry[]>(() => {
    const alertEntries: NotificationEntry[] = [...criticalAlerts, ...warningAlerts].map((alert) => ({
      kind: "alert",
      id: `alert-${alert.doctor_patient_alert_id}`,
      rawId: alert.doctor_patient_alert_id,
      occurredAt: alert.created_at,
      patientId: alert.patient_id,
      href: `/panel/pacientes/${alert.patient_id}`,
      title: alert.title,
      message: alert.message,
      patientName: alert.patient_name ?? "Paciente sin nombre",
      tone: alert.severity,
      badge: "Alerta clinica",
      stateLabel: alert.status === "acknowledged" ? "Reconocida" : "Abierta",
    }));
    const requestEntries: NotificationEntry[] = actionableRequests.map((request) => ({
      kind: "request",
      id: `request-${request.prescription_request_id}`,
      rawId: request.prescription_request_id,
      occurredAt: request.requested_at,
      patientId: request.patient_id,
      href: `/panel/pacientes/${request.patient_id}`,
      title: `Pedido de ${request.medication_name}`,
      message: "La solicitud necesita revision medica para continuar el circuito de receta.",
      patientName: request.patient_name,
      tone: "info",
      badge: "Pedido",
      stateLabel: requestStatusLabels[request.status],
    }));

    return [...alertEntries, ...requestEntries].sort((left, right) => {
      return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    });
  }, [actionableRequests, criticalAlerts, warningAlerts]);

  async function handleMarkAsRead(entry: NotificationEntry) {
    setErrorMessage(null);
    setActiveNotificationId(entry.id);

    try {
      if (entry.kind === "alert") {
        await updateDoctorAlertStatus(entry.rawId, { status: "closed" });
        onAlertClosed(entry.rawId);
      } else {
        onRequestDismissed(entry.rawId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la notificacion.",
      );
    } finally {
      setActiveNotificationId(null);
    }
  }

  return (
    <aside className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden border-l border-white/60 bg-[linear-gradient(180deg,_rgba(248,251,255,0.98)_0%,_rgba(239,246,255,0.96)_32%,_rgba(255,255,255,0.98)_100%)] shadow-[-24px_0_60px_rgba(15,23,42,0.12)]">
      <section className="border-b border-blue-100/80 px-6 py-6 shadow-[0_14px_40px_rgba(37,99,235,0.08)] md:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">Actividad medica</Badge>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                Notificaciones en tiempo de trabajo
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-blue-100 bg-white/90 text-blue-700">
              <BellRing className="h-5 w-5" />
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                aria-label="Cerrar notificaciones"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="mx-6 mt-6 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mx-7">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-5 md:px-6">
        <div className="mb-4 grid grid-cols-1 gap-3 px-2 sm:grid-cols-3">
          <div className="rounded-[20px] border border-rose-100 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Urgentes</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{criticalAlerts.length}</p>
          </div>
          <div className="rounded-[20px] border border-amber-100 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Seguimiento</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{warningAlerts.length}</p>
          </div>
          <div className="rounded-[20px] border border-blue-100 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pedidos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{actionableRequests.length}</p>
          </div>
        </div>

        {notificationEntries.length === 0 ? (
          <div className="mx-2 flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="max-w-md space-y-3">
              <p className="text-lg font-semibold text-slate-900">No hay actividad pendiente</p>
              <p className="text-sm leading-6 text-slate-500">
                Cuando haya alertas clinicas o pedidos que requieran accion, van a aparecer aca en
                orden descendente.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            <div className="space-y-4 pb-2">
              {notificationEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  onClick={onClose}
                  className={
                    entry.tone === "critical"
                      ? "group block rounded-[26px] border border-rose-200 bg-[linear-gradient(180deg,_rgba(255,241,242,0.98)_0%,_rgba(255,255,255,0.98)_100%)] p-5 shadow-[0_18px_40px_rgba(244,63,94,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-[0_24px_42px_rgba(244,63,94,0.18)]"
                      : "group block rounded-[26px] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_42px_rgba(37,99,235,0.14)]"
                  }
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        entry.tone === "critical"
                          ? "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-rose-100 text-rose-700"
                          : entry.tone === "warning"
                            ? "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-amber-50 text-amber-600"
                            : "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600"
                      }
                    >
                      {entry.kind === "alert" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <ClipboardList className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            entry.tone === "critical"
                              ? "border-rose-200 bg-rose-100 text-rose-700"
                              : entry.tone === "warning"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                          }
                        >
                          {entry.badge}
                        </Badge>
                        <Badge className="border-slate-200 bg-white text-slate-600">
                          {entry.stateLabel}
                        </Badge>
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                          {new Date(entry.occurredAt).toLocaleString("es-AR")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{entry.title}</h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {entry.patientName}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{entry.message}</p>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-400">Paciente #{entry.patientId}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={activeNotificationId === entry.id}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleMarkAsRead(entry);
                            }}
                            className={
                              entry.tone === "critical"
                                ? "text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                                : "text-slate-600 hover:bg-slate-100"
                            }
                          >
                            <CheckCheck className="h-4 w-4" />
                            Marcar leida
                          </Button>
                          <span className="font-medium text-blue-700 transition group-hover:text-blue-800">
                            Abrir ficha
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
