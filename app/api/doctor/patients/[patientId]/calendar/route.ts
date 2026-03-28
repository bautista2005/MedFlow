import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import {
  buildDoctorPatientWeeklyCalendar,
  InvalidCalendarWeekError,
} from "@/lib/calendar/weekly-calendar";

export const runtime = "nodejs";

type PatientCalendarContext = {
  params: Promise<{
    patientId: string;
  }>;
};

export async function GET(request: Request, context: PatientCalendarContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { patientId } = await context.params;
    const parsedPatientId = Number(patientId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
      return NextResponse.json({ error: "Paciente invalido." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;

    const calendar = await buildDoctorPatientWeeklyCalendar({
      patientId: parsedPatientId,
      activeDoctorId: doctor.activeDoctorId,
      weekStart,
    });

    return NextResponse.json(calendar);
  } catch (error) {
    if (error instanceof DoctorSessionError) {
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
