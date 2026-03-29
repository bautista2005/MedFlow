import Link from "next/link";
import { BellRing, Check, ExternalLink } from "lucide-react";

import type {
  PatientNotificationCategory,
  PatientNotificationPriority,
  PatientNotificationSummary,
} from "@/lib/patient/types";
import { getDoctorMessageNotificationMetadata } from "@/lib/patient/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PatientNotificationItemProps = {
  notification: PatientNotificationSummary;
  isUpdating: boolean;
  onMarkAsRead: (notificationId: number) => void;
};

const categoryLabelMap: Record<PatientNotificationCategory, string> = {
  calendar: "Calendario",
  prescription: "Recetas",
  doctor_message: "Equipo medico",
  system: "Sistema",
};

const categoryClassNameMap: Record<PatientNotificationCategory, string> = {
  calendar: "border-emerald-200 bg-emerald-50 text-emerald-900",
  prescription: "border-blue-200 bg-blue-50 text-blue-900",
  doctor_message: "border-amber-200 bg-amber-50 text-amber-900",
  system: "border-slate-200 bg-slate-100 text-slate-700",
};

const priorityAccentMap: Record<PatientNotificationPriority, string> = {
  low: "from-slate-200 to-slate-300",
  normal: "from-blue-200 to-emerald-200",
  high: "from-rose-200 to-amber-200",
};

function formatScheduledDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getCalendarContext(notification: PatientNotificationSummary) {
  if (notification.category !== "calendar") {
    return null;
  }

  const scheduledForDate =
    typeof notification.metadata.scheduled_for_date === "string"
      ? notification.metadata.scheduled_for_date
      : null;
  const scheduledTime =
    typeof notification.metadata.scheduled_time === "string"
      ? notification.metadata.scheduled_time
      : null;
  const slotLabel =
    typeof notification.metadata.slot_label === "string"
      ? notification.metadata.slot_label
      : null;

  if (!scheduledForDate && !scheduledTime && !slotLabel) {
    return null;
  }

  const fragments = [];

  if (scheduledForDate) {
    fragments.push(`Programada para el ${formatScheduledDate(scheduledForDate)}`);
  }

  if (scheduledTime) {
    fragments.push(`a las ${scheduledTime}`);
  }

  if (slotLabel) {
    fragments.push(slotLabel);
  }

  return fragments.join(" · ");
}

function getDoctorMessageContext(notification: PatientNotificationSummary) {
  if (notification.category !== "doctor_message") {
    return null;
  }

  const metadata = getDoctorMessageNotificationMetadata(notification.metadata);

  if (!metadata) {
    return null;
  }

  const fragments = [];

  if (metadata.related_prescription_id) {
    fragments.push(`Relacionada con pedido #${metadata.related_prescription_id}`);
  }

  if (metadata.medication_name) {
    fragments.push(`Tratamiento: ${metadata.medication_name}`);
  } else if (metadata.related_treatment_id) {
    fragments.push(`Relacionada con tratamiento #${metadata.related_treatment_id}`);
  }

  return fragments.length > 0 ? fragments.join(" · ") : null;
}

export function PatientNotificationItem({
  notification,
  isUpdating,
  onMarkAsRead,
}: PatientNotificationItemProps) {
  const calendarContext = getCalendarContext(notification);
  const doctorMessageContext = getDoctorMessageContext(notification);

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[20px] border p-5 transition-all duration-200",
        notification.status === "unread"
          ? "border-blue-200 bg-white shadow-[0_18px_40px_rgba(37,99,235,0.10)]"
          : "border-slate-200 bg-slate-50/85 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
      ].join(" ")}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${priorityAccentMap[notification.priority]}`}
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={categoryClassNameMap[notification.category]}>
                {categoryLabelMap[notification.category]}
              </Badge>
              {notification.status === "unread" ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  Nueva
                </span>
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">{notification.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
              {calendarContext ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">{calendarContext}</p>
              ) : null}
              {doctorMessageContext ? (
                <p className="mt-2 text-xs font-medium text-amber-700">{doctorMessageContext}</p>
              ) : null}
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-blue-100 bg-blue-50 text-blue-700">
            {notification.status === "unread" ? (
              <BellRing className="h-5 w-5" />
            ) : (
              <Check className="h-5 w-5" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>Emitida el {new Date(notification.created_at).toLocaleString("es-AR")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {notification.action_url ? (
              <Button asChild size="sm" variant="outline">
                <Link href={notification.action_url}>
                  Ver detalle
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
            {notification.status === "unread" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkAsRead(notification.patient_notification_id)}
                disabled={isUpdating}
              >
                {isUpdating ? "Guardando..." : "Marcar como leida"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
