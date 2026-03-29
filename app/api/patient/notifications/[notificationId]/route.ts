import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import {
  markPatientNotificationRead,
  PatientNotificationError,
} from "@/lib/patient/notifications";

export const runtime = "nodejs";

type RequestContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: Request, context: RequestContext) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const { notificationId } = await context.params;
    const parsedNotificationId = Number(notificationId);

    if (!Number.isInteger(parsedNotificationId) || parsedNotificationId <= 0) {
      return NextResponse.json({ error: "Notificacion invalida." }, { status: 400 });
    }

    const result = await markPatientNotificationRead({
      patientId: patient.patientId,
      patientNotificationId: parsedNotificationId,
    });

    return NextResponse.json({
      deleted_notification_id: result.deletedNotificationId,
      message: "Notificacion eliminada.",
    });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PatientNotificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo eliminar la notificacion." },
      { status: 500 },
    );
  }
}
