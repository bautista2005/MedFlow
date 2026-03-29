import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import {
  markAllPatientNotificationsRead,
  PatientNotificationError,
} from "@/lib/patient/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const updatedCount = await markAllPatientNotificationsRead({
      patientId: patient.patientId,
    });

    return NextResponse.json({
      updated_count: updatedCount,
      message: "Notificaciones eliminadas.",
    });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PatientNotificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron eliminar las notificaciones." },
      { status: 500 },
    );
  }
}
