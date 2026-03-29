import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import { transitionPrescriptionRequestStatus } from "@/lib/patient/notifications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const maxFileSizeBytes = 8 * 1024 * 1024;

type RequestContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type PharmacyRelation = {
  name: string;
};

type PrescriptionRequestRow = {
  prescription_request_id: number;
  patient_id: number;
  active_doctor_id: number;
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
  preferred_pharmacy_id: number | null;
  assigned_pharmacy_id: number | null;
  assigned_pharmacy: PharmacyRelation | PharmacyRelation[] | null;
};

function buildStoragePath(activeDoctorId: number, requestId: number, fileName: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${activeDoctorId}/${requestId}/${Date.now()}-${safeFileName}`;
}

export async function POST(request: Request, context: RequestContext) {
  let storagePath: string | null = null;

  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { requestId } = await context.params;
    const parsedRequestId = Number(requestId);

    if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
      return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes adjuntar un archivo." },
        { status: 400 },
      );
    }

    if (!(file.type === "application/pdf" || file.type === "image/png")) {
      return NextResponse.json(
        { error: "Solo se aceptan archivos PNG o PDF." },
        { status: 400 },
      );
    }

    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { error: "El archivo supera el maximo de 8 MB." },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: prescriptionRequest, error: requestError } = await supabase
      .from("prescription_requests")
      .select(
        "prescription_request_id, patient_id, active_doctor_id, patient_medication_id, status, medication_name_snapshot, preferred_pharmacy_id, assigned_pharmacy_id, assigned_pharmacy:pharmacies!prescription_requests_assigned_pharmacy_id_fkey(name)",
      )
      .eq("prescription_request_id", parsedRequestId)
      .eq("active_doctor_id", doctor.activeDoctorId)
      .maybeSingle<PrescriptionRequestRow>();

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

    if (
      prescriptionRequest.status !== "pending" &&
      prescriptionRequest.status !== "reviewed"
    ) {
      return NextResponse.json(
        { error: "Este pedido ya fue resuelto." },
        { status: 409 },
      );
    }

    const { data: existingFile } = await supabase
      .from("prescription_files")
      .select("prescription_file_id")
      .eq("prescription_request_id", parsedRequestId)
      .eq("is_current", true)
      .maybeSingle();

    if (existingFile) {
      return NextResponse.json(
        { error: "Este pedido ya tiene una receta actual cargada." },
        { status: 409 },
      );
    }

    storagePath = buildStoragePath(
      doctor.activeDoctorId,
      parsedRequestId,
      file.name || "receta",
    );

    const { error: uploadError } = await supabase.storage
      .from("prescriptions")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "No se pudo subir el archivo de receta." },
        { status: 500 },
      );
    }

    const { data: insertedFile, error: insertError } = await supabase
      .from("prescription_files")
      .insert({
        prescription_request_id: parsedRequestId,
        patient_id: prescriptionRequest.patient_id,
        active_doctor_id: doctor.activeDoctorId,
        storage_bucket: "prescriptions",
        storage_path: storagePath,
        original_filename: file.name || "receta",
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        is_current: true,
      })
      .select("prescription_file_id")
      .single();

    if (insertError || !insertedFile) {
      await supabase.storage.from("prescriptions").remove([storagePath]);

      return NextResponse.json(
        { error: "No se pudo registrar la receta cargada." },
        { status: 500 },
      );
    }

    const pharmacyRelation = prescriptionRequest.assigned_pharmacy;
    const pharmacyName = Array.isArray(pharmacyRelation)
      ? (pharmacyRelation[0]?.name ?? null)
      : (pharmacyRelation?.name ?? null);
    const fileUploadedAt = new Date().toISOString();

    try {
      const uploadedRequest = await transitionPrescriptionRequestStatus({
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
        nextStatus: "prescription_uploaded",
        pharmacyId: prescriptionRequest.assigned_pharmacy_id,
        pharmacyName,
        resolvedAt: null,
        fileUploadedAt,
      });

      await transitionPrescriptionRequestStatus({
        request: uploadedRequest,
        nextStatus: "pharmacy_checking",
        pharmacyId: uploadedRequest.assignedPharmacyId,
        pharmacyName,
        resolvedAt: null,
      });
    } catch {
      await supabase
        .from("prescription_files")
        .delete()
        .eq("prescription_file_id", insertedFile.prescription_file_id);
      await supabase.storage.from("prescriptions").remove([storagePath]);

      return NextResponse.json(
        { error: "No se pudo actualizar el estado del pedido." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Receta cargada y consulta de farmacia iniciada.",
      status: "pharmacy_checking",
    });
  } catch (error) {
    if (storagePath) {
      const supabase = createAdminSupabaseClient();
      await supabase.storage.from("prescriptions").remove([storagePath]);
    }

    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo cargar la receta." },
      { status: 500 },
    );
  }
}
