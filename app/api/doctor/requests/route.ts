import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import type {
  PrescriptionFileSummary,
  PrescriptionRequestSummary,
} from "@/lib/doctor/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RequestRow = {
  prescription_request_id: number;
  patient_id: number;
  status: PrescriptionRequestSummary["status"];
  requested_at: string;
  resolved_at: string | null;
  patient_note: string | null;
  doctor_note: string | null;
  medication_name_snapshot: string;
  patients:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  pharmacies:
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }
    | {
        pharmacy_id: number;
        name: string;
        zone: string | null;
        city: string | null;
      }[]
    | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: Request) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const supabase = createAdminSupabaseClient();
    const { data: rows, error } = await supabase
      .from("prescription_requests")
      .select(
        "prescription_request_id, patient_id, status, requested_at, resolved_at, patient_note, doctor_note, medication_name_snapshot, patients(name), pharmacies(pharmacy_id, name, zone, city)",
      )
      .eq("active_doctor_id", doctor.activeDoctorId)
      .order("requested_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los pedidos." },
        { status: 500 },
      );
    }

    const requestIds = (rows ?? []).map((item) => item.prescription_request_id);
    const currentFiles =
      requestIds.length === 0
        ? []
        : (
            await supabase
              .from("prescription_files")
              .select(
                "prescription_file_id, prescription_request_id, original_filename, mime_type, uploaded_at, is_current",
              )
              .in("prescription_request_id", requestIds)
              .eq("is_current", true)
          ).data ?? [];

    const fileByRequestId = new Map<number, PrescriptionFileSummary>(
      currentFiles.map((file) => [
        file.prescription_request_id,
        {
          prescription_file_id: file.prescription_file_id,
          original_filename: file.original_filename,
          mime_type: file.mime_type,
          uploaded_at: file.uploaded_at,
          is_current: file.is_current,
        },
      ]),
    );

    return NextResponse.json({
      requests: ((rows ?? []) as RequestRow[]).map((row) => ({
        prescription_request_id: row.prescription_request_id,
        patient_id: row.patient_id,
        patient_name: normalizeRelation(row.patients)?.name ?? "Paciente",
        medication_name: row.medication_name_snapshot,
        status: row.status,
        requested_at: row.requested_at,
        resolved_at: row.resolved_at,
        patient_note: row.patient_note,
        doctor_note: row.doctor_note,
        preferred_pharmacy: normalizeRelation(row.pharmacies),
        current_file: fileByRequestId.get(row.prescription_request_id) ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron cargar los pedidos." },
      { status: 500 },
    );
  }
}
