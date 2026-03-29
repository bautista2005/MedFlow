import { NextResponse } from "next/server";

import { PatientSessionError, requireAuthenticatedPatient } from "@/lib/auth/patient-session";
import { calculateMedicationStatus } from "@/lib/patient/medication-calculations";
import { createPrescriptionRequestNotification } from "@/lib/patient/notifications";
import {
  ACTIVE_PRESCRIPTION_REQUEST_STATUSES,
  type CreatePatientRequestPayload,
  type PrescriptionRequestStatus,
} from "@/lib/patient/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function normalizePatientNote(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const patient = await requireAuthenticatedPatient(request);
    const payload = (await request.json()) as CreatePatientRequestPayload;
    const patientMedicationId = Number(payload.patient_medication_id);

    if (!Number.isInteger(patientMedicationId) || patientMedicationId <= 0) {
      return NextResponse.json(
        { error: "Debes seleccionar un tratamiento valido." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: medication, error: medicationError } = await supabase
      .from("patient_medications")
      .select(
        "patient_medication_id, patient_id, active_doctor_id, medication_name, dose_text, frequency_text, pills_per_box, box_count, units_per_intake, intakes_per_day, start_date",
      )
      .eq("patient_medication_id", patientMedicationId)
      .maybeSingle();

    if (medicationError) {
      return NextResponse.json(
        { error: "No se pudo crear el pedido." },
        { status: 500 },
      );
    }

    if (!medication || medication.patient_id !== patient.patientId) {
      return NextResponse.json(
        { error: "El tratamiento seleccionado no pertenece a tu cuenta." },
        { status: 404 },
      );
    }

    const { data: openRequest, error: openRequestError } = await supabase
      .from("prescription_requests")
      .select("prescription_request_id, status")
      .eq("patient_id", patient.patientId)
      .eq("patient_medication_id", patientMedicationId)
      .in("status", ACTIVE_PRESCRIPTION_REQUEST_STATUSES satisfies PrescriptionRequestStatus[])
      .maybeSingle();

    if (openRequestError) {
      return NextResponse.json(
        { error: "No se pudo crear el pedido." },
        { status: 500 },
      );
    }

    const calculation = calculateMedicationStatus(
      {
        pills_per_box: medication.pills_per_box,
        box_count: medication.box_count,
        units_per_intake: medication.units_per_intake,
        intakes_per_day: medication.intakes_per_day,
        start_date: medication.start_date,
      },
      {
        hasOpenRequest: Boolean(openRequest),
      },
    );

    if (!calculation.can_request_refill) {
      const statusCode = calculation.blocked_reason === "request_in_progress" ? 409 : 422;

      return NextResponse.json(
        {
          error: calculation.blocked_message ?? "No se puede crear el pedido todavia.",
        },
        { status: statusCode },
      );
    }

    const { data: insertedRequest, error: insertError } = await supabase
      .from("prescription_requests")
      .insert({
        patient_id: patient.patientId,
        active_doctor_id: medication.active_doctor_id,
        patient_medication_id: medication.patient_medication_id,
        preferred_pharmacy_id: patient.preferredPharmacyId,
        assigned_pharmacy_id: patient.preferredPharmacyId,
        status: "pending" satisfies PrescriptionRequestStatus,
        patient_note: normalizePatientNote(payload.patient_note),
        medication_name_snapshot: medication.medication_name,
        dose_snapshot: medication.dose_text,
        frequency_snapshot: medication.frequency_text,
      })
      .select("prescription_request_id")
      .maybeSingle();

    if (insertError || !insertedRequest) {
      return NextResponse.json(
        { error: "No se pudo crear el pedido." },
        { status: 500 },
      );
    }

    await createPrescriptionRequestNotification({
      type: "prescription_request_created",
      patientId: patient.patientId,
      activeDoctorId: medication.active_doctor_id,
      patientMedicationId: medication.patient_medication_id,
      prescriptionRequestId: insertedRequest.prescription_request_id,
      medicationName: medication.medication_name,
      preferredPharmacyId: patient.preferredPharmacyId,
      assignedPharmacyId: patient.preferredPharmacyId,
    });

    await createPrescriptionRequestNotification({
      type: "prescription_request_waiting_doctor",
      patientId: patient.patientId,
      activeDoctorId: medication.active_doctor_id,
      patientMedicationId: medication.patient_medication_id,
      prescriptionRequestId: insertedRequest.prescription_request_id,
      medicationName: medication.medication_name,
      preferredPharmacyId: patient.preferredPharmacyId,
      assignedPharmacyId: patient.preferredPharmacyId,
    });

    return NextResponse.json({
      prescription_request_id: insertedRequest.prescription_request_id,
      message: "Pedido creado correctamente.",
    });
  } catch (error) {
    if (error instanceof PatientSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo crear el pedido." },
      { status: 500 },
    );
  }
}
