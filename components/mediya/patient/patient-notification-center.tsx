import { BellDot, CheckCheck } from "lucide-react";
import Link from "next/link";

import type { PatientNotificationSummary } from "@/lib/patient/types";
import { PatientNotificationItem } from "@/components/mediya/patient/patient-notification-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PatientNotificationCenterProps = {
  notifications: PatientNotificationSummary[];
  unreadCount: number;
  activeNotificationId: number | null;
  isMarkingAll: boolean;
  onMarkAsRead: (notificationId: number) => void;
  onMarkAllAsRead: () => void;
  title?: string;
  description?: string;
  emptyMessage?: string;
  historyHref?: string | null;
  historyLabel?: string;
  showMarkAll?: boolean;
};

export function PatientNotificationCenter({
  notifications,
  unreadCount,
  activeNotificationId,
  isMarkingAll,
  onMarkAsRead,
  onMarkAllAsRead,
  title = "Centro del paciente",
  description = "Eventos de recetas, recordatorios y novedades importantes en un solo feed.",
  emptyMessage = "Cuando se generen eventos de recetas o recordatorios, van a aparecer aca.",
  historyHref = null,
  historyLabel = "Ver historial completo",
  showMarkAll = true,
}: PatientNotificationCenterProps) {
  return (
    <Card className="border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(240,253,250,0.98))] shadow-[0_24px_60px_rgba(16,185,129,0.10)]">
      <CardHeader className="pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">
              Notificaciones
            </Badge>
            <div className="space-y-1">
              <CardTitle className="font-sans text-[1.7rem] font-semibold tracking-[-0.03em] text-slate-900">
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-emerald-100 bg-emerald-50 text-emerald-700">
            <BellDot className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {unreadCount > 0
                ? `${unreadCount} notificacion${unreadCount === 1 ? "" : "es"} sin leer`
                : "No tenes notificaciones pendientes"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              El feed se ordena por fecha y conserva el historial reciente del paciente.
            </p>
          </div>
          {showMarkAll ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onMarkAllAsRead}
              disabled={isMarkingAll || unreadCount === 0}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              {isMarkingAll ? "Actualizando..." : "Marcar todo como leido"}
            </Button>
          ) : null}
        </div>

        {historyHref ? (
          <div className="flex justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={historyHref}>{historyLabel}</Link>
            </Button>
          </div>
        ) : null}

        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <PatientNotificationItem
                key={notification.patient_notification_id}
                notification={notification}
                isUpdating={activeNotificationId === notification.patient_notification_id}
                onMarkAsRead={onMarkAsRead}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-emerald-200 bg-white/80 px-5 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
