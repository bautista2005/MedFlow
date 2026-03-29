import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { createDoctorFollowUpNotification } from "@/lib/patient/notifications";
import type { SendDoctorPatientNotificationPayload } from "@/lib/doctor/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PatientContext = {
  params: Promise<{
    patientId: string;
  }>;
};

export async function POST(request: Request, context: PatientContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { patientId } = await context.params;
    const parsedPatientId = Number(patientId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
      return NextResponse.json({ error: "Paciente invalido." }, { status: 400 });
    }

    const payload = (await request.json()) as SendDoctorPatientNotificationPayload;
    const message = typeof payload.message === "string" ? payload.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Ingresa un mensaje para el paciente." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: relation, error: relationError } = await supabase
      .from("patient_doctors")
      .select("patient_id")
      .eq("active_doctor_id", doctor.activeDoctorId)
      .eq("patient_id", parsedPatientId)
      .maybeSingle();

    if (relationError) {
      return NextResponse.json({ error: "No se pudo validar la relacion medico-paciente." }, { status: 500 });
    }

    if (!relation) {
      return NextResponse.json({ error: "El paciente no pertenece al medico autenticado." }, { status: 404 });
    }

    await createDoctorFollowUpNotification({
      patientId: parsedPatientId,
      activeDoctorId: doctor.activeDoctorId,
      title: "Seguimiento del equipo medico",
      message,
    });

    return NextResponse.json({ message: "Notificacion enviada al paciente." });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo enviar la notificacion al paciente." },
      { status: 500 },
    );
  }
}
