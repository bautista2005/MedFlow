import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ResolveIdentifierRequest = {
  identifier?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dniPattern = /^\d{7,10}$/;

export async function POST(request: Request) {
  const payload = (await request.json()) as ResolveIdentifierRequest;
  const identifier = payload.identifier?.trim() ?? "";

  if (!identifier) {
    return NextResponse.json(
      { error: "Ingresá un email o DNI." },
      { status: 400 },
    );
  }

  if (emailPattern.test(identifier)) {
    return NextResponse.json({
      email: identifier.toLowerCase(),
      source: "email",
    });
  }

  if (!dniPattern.test(identifier)) {
    return NextResponse.json(
      { error: "Ingresá un email o DNI válido." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: doctor, error: doctorError } = await supabase
    .from("active_doctors")
    .select("email")
    .eq("dni", identifier)
    .maybeSingle();

  if (doctorError) {
    return NextResponse.json(
      { error: "No se pudo resolver el usuario." },
      { status: 500 },
    );
  }

  if (doctor?.email) {
    return NextResponse.json({
      email: doctor.email,
      source: "doctor",
    });
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("email")
    .eq("dni", identifier)
    .maybeSingle();

  if (patientError) {
    return NextResponse.json(
      { error: "No se pudo resolver el usuario." },
      { status: 500 },
    );
  }

  if (!patient?.email) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    email: patient.email,
    source: "patient",
  });
}
