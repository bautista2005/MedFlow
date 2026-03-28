import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);

    return NextResponse.json({
      doctor: {
        name: doctor.name,
        email: doctor.email,
      },
    });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el perfil del médico." },
      { status: 500 },
    );
  }
}
