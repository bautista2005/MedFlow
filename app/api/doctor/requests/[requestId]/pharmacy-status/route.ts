import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { transitionPrescriptionRequestStatus } from "@/lib/patient/notifications";
import type { PrescriptionRequestStatus } from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RequestContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type PharmacyRelation = {
  pharmacy_id: number;
  name: string;
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
  assigned_pharmacy: PharmacyRelation | PharmacyRelation[] | null;
};

type Payload = {
  status?: "pharmacy_checking" | "awaiting_alternative_pharmacy" | "ready_for_pickup";
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function PATCH(request: Request, context: RequestContext) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { requestId } = await context.params;
    const parsedRequestId = Number(requestId);

    if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
      return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
    }

    const payload = (await request.json()) as Payload;

    if (
      payload.status !== "pharmacy_checking" &&
      payload.status !== "awaiting_alternative_pharmacy" &&
      payload.status !== "ready_for_pickup"
    ) {
      return NextResponse.json({ error: "Estado de farmacia invalido." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: prescriptionRequest, error } = await supabase
      .from("prescription_requests")
      .select(
        "prescription_request_id, patient_id, active_doctor_id, patient_medication_id, status, medication_name_snapshot, preferred_pharmacy_id, assigned_pharmacy_id, assigned_pharmacy:pharmacies!prescription_requests_assigned_pharmacy_id_fkey(pharmacy_id, name)",
      )
      .eq("prescription_request_id", parsedRequestId)
      .eq("active_doctor_id", doctor.activeDoctorId)
      .maybeSingle<RequestRow>();

    if (error) {
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

    const assignedPharmacy = normalizeRelation(prescriptionRequest.assigned_pharmacy);

    if (
      !assignedPharmacy &&
      (payload.status === "pharmacy_checking" || payload.status === "ready_for_pickup")
    ) {
      return NextResponse.json(
        { error: "El pedido necesita una farmacia asignada para continuar." },
        { status: 409 },
      );
    }

    if (
      payload.status === "pharmacy_checking" &&
      prescriptionRequest.status !== "reviewed" &&
      prescriptionRequest.status !== "prescription_uploaded" &&
      prescriptionRequest.status !== "awaiting_alternative_pharmacy"
    ) {
      return NextResponse.json(
        { error: "El pedido no puede volver a consulta de farmacia desde su estado actual." },
        { status: 409 },
      );
    }

    if (
      payload.status === "ready_for_pickup" &&
      prescriptionRequest.status !== "prescription_uploaded" &&
      prescriptionRequest.status !== "pharmacy_checking"
    ) {
      return NextResponse.json(
        { error: "El pedido no puede marcarse listo para retirar desde su estado actual." },
        { status: 409 },
      );
    }

    if (
      payload.status === "awaiting_alternative_pharmacy" &&
      prescriptionRequest.status !== "prescription_uploaded" &&
      prescriptionRequest.status !== "pharmacy_checking" &&
      prescriptionRequest.status !== "no_stock_preferred"
    ) {
      return NextResponse.json(
        { error: "El pedido no puede pasar a farmacia alternativa desde su estado actual." },
        { status: 409 },
      );
    }

    const baseRequest = {
      prescriptionRequestId: prescriptionRequest.prescription_request_id,
      patientId: prescriptionRequest.patient_id,
      activeDoctorId: prescriptionRequest.active_doctor_id,
      patientMedicationId: prescriptionRequest.patient_medication_id,
      medicationName: prescriptionRequest.medication_name_snapshot,
      status: prescriptionRequest.status,
      preferredPharmacyId: prescriptionRequest.preferred_pharmacy_id,
      assignedPharmacyId: prescriptionRequest.assigned_pharmacy_id,
    };

    let nextRequest = baseRequest;

    if (
      payload.status === "awaiting_alternative_pharmacy" &&
      prescriptionRequest.status !== "no_stock_preferred"
    ) {
      nextRequest = await transitionPrescriptionRequestStatus({
        request: baseRequest,
        nextStatus: "no_stock_preferred",
        pharmacyId: assignedPharmacy?.pharmacy_id ?? prescriptionRequest.assigned_pharmacy_id,
        pharmacyName: assignedPharmacy?.name ?? null,
        resolvedAt: null,
      });
    }

    const updatedRequest = await transitionPrescriptionRequestStatus({
      request: nextRequest,
      nextStatus: payload.status,
      pharmacyId: assignedPharmacy?.pharmacy_id ?? nextRequest.assignedPharmacyId,
      pharmacyName: assignedPharmacy?.name ?? null,
      resolvedAt: payload.status === "ready_for_pickup" ? new Date().toISOString() : null,
    });

    return NextResponse.json({
      message:
        payload.status === "ready_for_pickup"
          ? "Pedido marcado como listo para retirar."
          : payload.status === "awaiting_alternative_pharmacy"
            ? "Pedido actualizado para pedir farmacia alternativa."
            : "Pedido enviado a consulta de farmacia.",
      status: updatedRequest.status,
    });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo actualizar el estado de farmacia." },
      { status: 500 },
    );
  }
}
