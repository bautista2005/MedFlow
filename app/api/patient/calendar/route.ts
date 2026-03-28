import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import {
  buildPatientWeeklyCalendar,
  InvalidCalendarWeekError,
} from "@/lib/calendar/weekly-calendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;

    const calendar = await buildPatientWeeklyCalendar({
      patientId: patient.patientId,
      weekStart,
    });

    return NextResponse.json(calendar);
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InvalidCalendarWeekError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el calendario del paciente." },
      { status: 500 },
    );
  }
}
