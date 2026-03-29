"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import type { PatientNotificationListResponse } from "@/lib/patient/types";
import {
  getPatientNotificationPreview,
  listPatientNotifications,
  markAllPatientNotificationsAsRead,
  markPatientNotificationAsRead,
} from "@/services/patient/patient-service";
import { PatientNotificationCenter } from "@/components/mediya/patient/patient-notification-center";
import { Badge } from "@/components/ui/badge";

type PatientNotificationsPanelProps = {
  mode?: "dashboard" | "page";
};

export function PatientNotificationsPanel({
  mode = "dashboard",
}: PatientNotificationsPanelProps) {
  const [data, setData] = useState<PatientNotificationListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const isPage = mode === "page";

  async function refresh() {
    const result = isPage
      ? await listPatientNotifications({ status: "unread" })
      : await getPatientNotificationPreview();

    setData(result);
  }

  useEffect(() => {
    let cancelled = false;

    const request = isPage
      ? listPatientNotifications({ status: "unread" })
      : getPatientNotificationPreview();

    void request
      .then((result) => {
        if (cancelled) {
          return;
        }

        setData(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "No se pudieron cargar las notificaciones.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isPage]);

  async function handleMarkAsRead(notificationId: number) {
    setMarkingNotificationId(notificationId);
    setErrorMessage(null);

    try {
      await markPatientNotificationAsRead(notificationId);
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la notificacion.",
      );
    } finally {
      setMarkingNotificationId(null);
    }
  }

  async function handleMarkAllAsRead() {
    setIsMarkingAll(true);
    setErrorMessage(null);

    try {
      await markAllPatientNotificationsAsRead();
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron actualizar las notificaciones.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-5">
      {isPage ? (
        <section className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,_rgba(16,185,129,0.10),_rgba(16,185,129,0.04)_55%,_rgba(255,255,255,0.96))] px-6 py-6 shadow-[0_22px_50px_rgba(16,185,129,0.10)] md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">
                Notificaciones
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                  Historial del paciente
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Revisa recordatorios, estados de recetas y mensajes del equipo medico en una
                  vista dedicada.
                </p>
              </div>
            </div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
              <Bell className="h-5 w-5" />
            </div>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <PatientNotificationCenter
        notifications={notifications}
        unreadCount={data?.unread_count ?? 0}
        activeNotificationId={markingNotificationId}
        isMarkingAll={isMarkingAll}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        title={isPage ? "Todas tus notificaciones" : "Resumen reciente"}
        description={
          isPage
            ? "Aca ves solo las notificaciones pendientes para que desaparezcan al marcarlas como leidas."
            : "Las tres notificaciones pendientes mas recientes aparecen aca para que revises lo importante rapido."
        }
        emptyMessage={
          isPage
            ? "No tenes notificaciones pendientes."
            : "Cuando se generen nuevos eventos pendientes, vas a ver un resumen breve en este bloque."
        }
        historyHref={!isPage ? "/paciente/notificaciones" : null}
        historyLabel="Ver todas las notificaciones"
        showMarkAll={isPage}
      />
    </div>
  );
}
