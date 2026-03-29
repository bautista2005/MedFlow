import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import { listPatientChatHistory, PatientChatbotError } from "@/lib/chatbot/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit && /^\d+$/.test(rawLimit) ? Number(rawLimit) : undefined;
    const messages = await listPatientChatHistory({
      patientId: patient.patientId,
      limit,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PatientChatbotError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el historial del asistente." },
      { status: 500 },
    );
  }
}
