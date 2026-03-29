"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  MessageSquareText,
  X,
} from "lucide-react";

import type { PatientNotificationListResponse, PatientNotificationSummary } from "@/lib/patient/types";
import {
  markAllPatientNotificationsAsRead,
  markPatientNotificationAsRead,
} from "@/services/patient/patient-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PatientNotificationsDrawerProps = {
  notifications: PatientNotificationListResponse["notifications"];
  unreadCount: number;
  onNotificationsChange: (payload: PatientNotificationListResponse) => void;
  onClose?: () => void;
};

const categoryLabels: Record<PatientNotificationSummary["category"], string> = {
  calendar: "Calendario",
  prescription: "Recetas",
  doctor_message: "Equipo médico",
  system: "Sistema",
};

function getNotificationIcon(notification: PatientNotificationSummary) {
  switch (notification.category) {
    case "calendar":
      return CalendarDays;
    case "prescription":
      return ClipboardList;
    case "doctor_message":
      return MessageSquareText;
    default:
      return BellRing;
  }
}

export function PatientNotificationsDrawer({
  notifications,
  unreadCount,
  onNotificationsChange,
  onClose,
}: PatientNotificationsDrawerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const prescriptionCount = useMemo(
    () => notifications.filter((notification) => notification.category === "prescription").length,
    [notifications],
  );
  const calendarCount = useMemo(
    () => notifications.filter((notification) => notification.category === "calendar").length,
    [notifications],
  );
  const doctorMessageCount = useMemo(
    () => notifications.filter((notification) => notification.category === "doctor_message").length,
    [notifications],
  );

  async function refreshAfterUpdate() {
    onNotificationsChange({
      notifications: [],
      unread_count: 0,
    });
  }

  async function handleMarkAllAsRead() {
    setIsMarkingAll(true);
    setErrorMessage(null);

    try {
      await markAllPatientNotificationsAsRead();
      await refreshAfterUpdate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron actualizar las notificaciones.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleMarkAsRead(notificationId: number) {
    setActiveNotificationId(notificationId);
    setErrorMessage(null);

    try {
      await markPatientNotificationAsRead(notificationId);
      onNotificationsChange({
        notifications: notifications.filter(
          (notification) => notification.patient_notification_id !== notificationId,
        ),
        unread_count: Math.max(0, unreadCount - 1),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la notificación.",
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
            <Badge className="border-blue-200 bg-blue-50 text-blue-900">
              Actividad del paciente
            </Badge>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                Notificaciones recientes
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
          <div className="rounded-[20px] border border-blue-100 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Sin leer
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{unreadCount}</p>
          </div>
          <div className="rounded-[20px] border border-emerald-100 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Recetas
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{prescriptionCount}</p>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white/95 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recordatorios
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {calendarCount + doctorMessageCount}
            </p>
          </div>
        </div>

        <div className="mb-4 flex justify-end px-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMarkingAll || unreadCount === 0}
            onClick={() => void handleMarkAllAsRead()}
          >
            <CheckCheck className="h-4 w-4" />
            {isMarkingAll ? "Actualizando..." : "Marcar todas como leídas"}
          </Button>
        </div>

        {notifications.length === 0 ? (
          <div className="mx-2 flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="max-w-md space-y-3">
              <p className="text-lg font-semibold text-slate-900">No hay actividad pendiente</p>
              <p className="text-sm leading-6 text-slate-500">
                Cuando se generen recordatorios, estados de recetas o mensajes del equipo médico,
                van a aparecer acá en orden descendente.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            <div className="space-y-4 pb-2">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification);

                return (
                  <article
                    key={notification.patient_notification_id}
                    className="group rounded-[26px] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_42px_rgba(37,99,235,0.14)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                            {categoryLabels[notification.category]}
                          </Badge>
                          <Badge className="border-slate-200 bg-white text-slate-600">
                            {notification.status === "unread" ? "Sin leer" : "Leída"}
                          </Badge>
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                            {new Date(notification.created_at).toLocaleString("es-AR")}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {notification.title}
                          </h3>
                          <p className="text-sm leading-6 text-slate-600">
                            {notification.message}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-400">
                            {notification.action_url ? "Con acceso directo disponible" : "Sin acción adicional"}
                          </span>
                          <div className="flex items-center gap-2">
                            {notification.status === "unread" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={activeNotificationId === notification.patient_notification_id}
                                onClick={() =>
                                  void handleMarkAsRead(notification.patient_notification_id)
                                }
                                className="text-slate-600 hover:bg-slate-100"
                              >
                                <CheckCheck className="h-4 w-4" />
                                Marcar leída
                              </Button>
                            ) : null}
                            {notification.action_url ? (
                              <Button asChild size="sm" variant="ghost">
                                <Link href={notification.action_url} onClick={onClose}>
                                  Abrir detalle
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
