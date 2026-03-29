import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { updateDoctorAlertStatus } from "@/lib/chatbot/alerts";
import type { UpdateDoctorAlertStatusPayload } from "@/lib/doctor/types";

export const runtime = "nodejs";

type AlertContext = {
  params: Promise<{
    alertId: string;
  }>;
};

export async function PATCH(request: Request, context: AlertContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { alertId } = await context.params;
    const parsedAlertId = Number(alertId);

    if (!Number.isInteger(parsedAlertId) || parsedAlertId <= 0) {
      return NextResponse.json({ error: "Alerta invalida." }, { status: 400 });
    }

    const payload = (await request.json()) as UpdateDoctorAlertStatusPayload;

    if (payload.status !== "acknowledged" && payload.status !== "closed") {
      return NextResponse.json({ error: "Estado de alerta invalido." }, { status: 400 });
    }

    const alert = await updateDoctorAlertStatus({
      alertId: parsedAlertId,
      activeDoctorId: doctor.activeDoctorId,
      status: payload.status,
    });

    return NextResponse.json({ alert, message: "Alerta actualizada." });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "No se pudo actualizar la alerta." }, { status: 500 });
  }
}
