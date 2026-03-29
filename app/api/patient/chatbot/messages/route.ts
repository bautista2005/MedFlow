import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import { PatientChatbotError, processPatientChatMessage } from "@/lib/chatbot/service";
import type { PatientChatMessagePayload } from "@/lib/patient/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const payload = (await request.json()) as PatientChatMessagePayload;
    const result = await processPatientChatMessage({
      patientId: patient.patientId,
      message: payload.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PatientChatbotError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo procesar el mensaje del asistente." },
      { status: 500 },
    );
  }
}
