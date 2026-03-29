"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import type {
  PatientNotificationListResponse,
  PatientNotificationStatusFilter,
} from "@/lib/patient/types";
import {
  getPatientNotificationPreview,
  listPatientNotifications,
  markAllPatientNotificationsAsRead,
  markPatientNotificationAsRead,
} from "@/services/patient/patient-service";
import { PatientNotificationCenter } from "@/components/mediya/patient/patient-notification-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PatientNotificationsPanelProps = {
  mode?: "dashboard" | "page";
};

const statusLabels: Record<PatientNotificationStatusFilter, string> = {
  all: "Todas",
  unread: "Sin leer",
  read: "Leidas",
};

export function PatientNotificationsPanel({
  mode = "dashboard",
}: PatientNotificationsPanelProps) {
  const [data, setData] = useState<PatientNotificationListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<PatientNotificationStatusFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const isPage = mode === "page";

  async function refresh(nextStatus = statusFilter) {
    const result = isPage
      ? await listPatientNotifications({ status: nextStatus })
      : await getPatientNotificationPreview();

    setData(result);
  }

  useEffect(() => {
    let cancelled = false;

    const request = isPage
      ? listPatientNotifications({ status: statusFilter })
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
  }, [isPage, statusFilter]);

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
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-emerald-100 bg-white/90 text-emerald-700">
              <BellRing className="h-5 w-5" />
            </div>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isPage ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "unread", "read"] as const).map((filter) => (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={statusFilter === filter ? "default" : "outline"}
                onClick={() => setStatusFilter(filter)}
              >
                {statusLabels[filter]}
              </Button>
            ))}
          </div>
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
            ? "El feed unifica eventos de recetas, calendario, sistema y observaciones clinicas."
            : "Las tres notificaciones mas recientes aparecen aca para que revises lo importante rapido."
        }
        emptyMessage={
          isPage
            ? "Todavia no tenes notificaciones registradas para este filtro."
            : "Cuando se generen nuevos eventos, vas a ver un resumen breve en este bloque."
        }
        historyHref={!isPage ? "/paciente/notificaciones" : null}
        historyLabel="Ver todas las notificaciones"
        showMarkAll={isPage}
      />
    </div>
  );
}
