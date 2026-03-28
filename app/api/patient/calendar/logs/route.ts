import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import type { UpsertPatientCalendarLogPayload } from "@/lib/calendar/types";
import {
  PatientCalendarLogNotFoundError,
  PatientCalendarLogOwnershipError,
  PatientCalendarLogPayloadError,
  upsertPatientCalendarLog,
} from "@/lib/calendar/logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const payload = (await request.json()) as UpsertPatientCalendarLogPayload;

    const result = await upsertPatientCalendarLog({
      authUserId: patient.authUserId,
      patientId: patient.patientId,
      payload,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (
      error instanceof PatientCalendarLogPayloadError ||
      error instanceof PatientCalendarLogOwnershipError ||
      error instanceof PatientCalendarLogNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo guardar la adherencia del calendario." },
      { status: 500 },
    );
  }
}
