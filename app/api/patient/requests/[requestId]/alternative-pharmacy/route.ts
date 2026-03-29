import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import { transitionPrescriptionRequestStatus } from "@/lib/patient/notifications";
import type {
  PrescriptionRequestStatus,
  UpdatePatientAlternativePharmacyPayload,
} from "@/lib/patient/types";
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
  active_doctor_id: number;
  patient_medication_id: number;
  status: PrescriptionRequestStatus;
  medication_name_snapshot: string;
  preferred_pharmacy_id: number | null;
  assigned_pharmacy_id: number | null;
};

type PharmacyRow = {
  pharmacy_id: number;
  name: string;
  is_active: boolean;
};

export async function PATCH(request: Request, context: RequestContext) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const { requestId } = await context.params;
    const parsedRequestId = Number(requestId);

    if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
      return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
    }

    const payload = (await request.json()) as UpdatePatientAlternativePharmacyPayload;
    const pharmacyId = Number(payload.pharmacy_id);

    if (!Number.isInteger(pharmacyId) || pharmacyId <= 0) {
      return NextResponse.json(
        { error: "Debes seleccionar una farmacia valida." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const [{ data: prescriptionRequest, error: requestError }, { data: pharmacy, error: pharmacyError }] =
      await Promise.all([
        supabase
          .from("prescription_requests")
          .select(
            "prescription_request_id, patient_id, active_doctor_id, patient_medication_id, status, medication_name_snapshot, preferred_pharmacy_id, assigned_pharmacy_id",
          )
          .eq("prescription_request_id", parsedRequestId)
          .eq("patient_id", patient.patientId)
          .maybeSingle<RequestRow>(),
        supabase
          .from("pharmacies")
          .select("pharmacy_id, name, is_active")
          .eq("pharmacy_id", pharmacyId)
          .maybeSingle<PharmacyRow>(),
      ]);

    if (requestError || pharmacyError) {
      return NextResponse.json(
        { error: "No se pudo actualizar la farmacia del pedido." },
        { status: 500 },
      );
    }

    if (!prescriptionRequest) {
      return NextResponse.json(
        { error: "El pedido no pertenece al paciente autenticado." },
        { status: 404 },
      );
    }

    if (prescriptionRequest.status !== "awaiting_alternative_pharmacy") {
      return NextResponse.json(
        { error: "El pedido no esta esperando una farmacia alternativa." },
        { status: 409 },
      );
    }

    if (!pharmacy || !pharmacy.is_active) {
      return NextResponse.json(
        { error: "La farmacia seleccionada no esta disponible." },
        { status: 404 },
      );
    }

    const updatedRequest = await transitionPrescriptionRequestStatus({
      request: {
        prescriptionRequestId: prescriptionRequest.prescription_request_id,
        patientId: prescriptionRequest.patient_id,
        activeDoctorId: prescriptionRequest.active_doctor_id,
        patientMedicationId: prescriptionRequest.patient_medication_id,
        medicationName: prescriptionRequest.medication_name_snapshot,
        status: prescriptionRequest.status,
        preferredPharmacyId: prescriptionRequest.preferred_pharmacy_id,
        assignedPharmacyId: prescriptionRequest.assigned_pharmacy_id,
      },
      nextStatus: "pharmacy_checking",
      assignedPharmacyId: pharmacy.pharmacy_id,
      pharmacyId: pharmacy.pharmacy_id,
      pharmacyName: pharmacy.name,
      resolvedAt: null,
    });

    return NextResponse.json({
      message: "Farmacia alternativa actualizada correctamente.",
      status: updatedRequest.status,
    });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo actualizar la farmacia del pedido." },
      { status: 500 },
    );
  }
}
