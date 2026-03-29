import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import {
  listPatientNotifications,
  normalizePatientNotificationLimit,
  normalizePatientNotificationStatusFilter,
  PatientNotificationError,
} from "@/lib/patient/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const { searchParams } = new URL(request.url);
    const status = normalizePatientNotificationStatusFilter(searchParams.get("status"));
    const limit = normalizePatientNotificationLimit(searchParams.get("limit"));

    const result = await listPatientNotifications({
      patientId: patient.patientId,
      status,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PatientNotificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron cargar las notificaciones." },
      { status: 500 },
    );
  }
}
