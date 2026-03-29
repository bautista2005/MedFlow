import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { listDoctorAlerts } from "@/lib/chatbot/alerts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);
    const includeClosed = searchParams.get("includeClosed") === "true";
    const alerts = await listDoctorAlerts({
      activeDoctorId: doctor.activeDoctorId,
      includeClosed,
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron cargar las alertas del medico." },
      { status: 500 },
    );
  }
}
