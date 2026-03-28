import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicSupabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await publicSupabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: doctor, error: doctorError } = await adminSupabase
    .from("active_doctors")
    .select("active_doctor_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorError) {
    return NextResponse.json(
      { error: "No se pudo validar la sesión." },
      { status: 500 },
    );
  }

  if (doctor) {
    return NextResponse.json({ role: "doctor" });
  }

  const { data: patient, error: patientError } = await adminSupabase
    .from("patients")
    .select("patient_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (patientError) {
    return NextResponse.json(
      { error: "No se pudo validar la sesión." },
      { status: 500 },
    );
  }

  if (patient) {
    return NextResponse.json({ role: "patient" });
  }

  return NextResponse.json(
    { error: "No existe un perfil activo para esta cuenta." },
    { status: 404 },
  );
}
