import { NextResponse } from "next/server";

import { emitCalendarNotifications, CalendarNotificationDispatchError } from "@/lib/calendar/notifications";
import { getAutomationBearerToken } from "@/lib/env";

export const runtime = "nodejs";

type CalendarNotificationsDispatchPayload = {
  reference_at?: string;
  upcoming_window_minutes?: number;
  pending_grace_minutes?: number;
  pending_lookback_days?: number;
  include_upcoming?: boolean;
  include_pending?: boolean;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

function requireAutomationAccess(request: Request) {
  const configuredToken = getAutomationBearerToken();

  if (!configuredToken) {
    throw new CalendarNotificationDispatchError(
      "El proceso interno de notificaciones no tiene un token configurado.",
      503,
    );
  }

  if (getBearerToken(request) !== configuredToken) {
    throw new CalendarNotificationDispatchError("Unauthorized", 401);
  }
}

export async function POST(request: Request) {
  try {
    requireAutomationAccess(request);

    let payload: CalendarNotificationsDispatchPayload = {};
    const rawBody = await request.text();

    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody) as CalendarNotificationsDispatchPayload;
      } catch {
        throw new CalendarNotificationDispatchError(
          "El body de la ejecucion de notificaciones no es JSON valido.",
          400,
        );
      }
    }

    const result = await emitCalendarNotifications({
      referenceAt: payload.reference_at,
      upcomingWindowMinutes: payload.upcoming_window_minutes,
      pendingGraceMinutes: payload.pending_grace_minutes,
      pendingLookbackDays: payload.pending_lookback_days,
      includeUpcoming: payload.include_upcoming,
      includePending: payload.include_pending,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalendarNotificationDispatchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron emitir las notificaciones del calendario." },
      { status: 500 },
    );
  }
}
