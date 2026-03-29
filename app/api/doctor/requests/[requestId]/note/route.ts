import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { createDoctorObservationNotification } from "@/lib/patient/notifications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RequestContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type RequestRow = {
  prescription_request_id: number;
  patient_id: number;
  patient_medication_id: number;
  status:
    | "pending"
    | "reviewed"
    | "prescription_uploaded"
    | "pharmacy_checking"
    | "no_stock_preferred"
    | "awaiting_alternative_pharmacy"
    | "ready_for_pickup"
    | "cancelled";
  medication_name_snapshot: string;
  doctor_note: string | null;
};

function normalizeDoctorNote(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

export async function PATCH(request: Request, context: RequestContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { requestId } = await context.params;
    const parsedRequestId = Number(requestId);

    if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
      return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
    }

    const payload = (await request.json()) as { doctor_note?: unknown };
    const doctorNote = normalizeDoctorNote(payload.doctor_note);

    if (!doctorNote) {
      return NextResponse.json(
        { error: "Ingresa una observacion medica valida." },
        { status: 400 },
      );
    }

    if (doctorNote.length > 600) {
      return NextResponse.json(
        { error: "La observacion no puede superar los 600 caracteres." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: prescriptionRequest, error: requestError } = await supabase
      .from("prescription_requests")
      .select(
        "prescription_request_id, patient_id, patient_medication_id, status, medication_name_snapshot, doctor_note",
      )
      .eq("prescription_request_id", parsedRequestId)
      .eq("active_doctor_id", doctor.activeDoctorId)
      .maybeSingle<RequestRow>();

    if (requestError) {
      return NextResponse.json(
        { error: "No se pudo validar el pedido." },
        { status: 500 },
      );
    }

    if (!prescriptionRequest) {
      return NextResponse.json(
        { error: "El pedido no pertenece al medico autenticado." },
        { status: 404 },
      );
    }

    const nextStatus =
      prescriptionRequest.status === "pending" ? "reviewed" : prescriptionRequest.status;

    const { error: updateError } = await supabase
      .from("prescription_requests")
      .update({
        doctor_note: doctorNote,
        status: nextStatus,
      })
      .eq("prescription_request_id", parsedRequestId)
      .eq("active_doctor_id", doctor.activeDoctorId);

    if (updateError) {
      return NextResponse.json(
        { error: "No se pudo guardar la observacion." },
        { status: 500 },
      );
    }

    if (prescriptionRequest.doctor_note !== doctorNote) {
      await createDoctorObservationNotification({
        patientId: prescriptionRequest.patient_id,
        activeDoctorId: doctor.activeDoctorId,
        patientMedicationId: prescriptionRequest.patient_medication_id,
        prescriptionRequestId: prescriptionRequest.prescription_request_id,
        medicationName: prescriptionRequest.medication_name_snapshot,
        observation: doctorNote,
      });
    }

    return NextResponse.json({
      message: "Observacion guardada correctamente.",
      doctor_note: doctorNote,
      status: nextStatus,
    });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo guardar la observacion." },
      { status: 500 },
    );
  }
}
