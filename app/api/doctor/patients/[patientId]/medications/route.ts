import { NextResponse } from "next/server";

import { DoctorSessionError, requireAuthenticatedDoctor } from "@/lib/auth/doctor-session";
import {
  normalizePatientTreatmentInput,
  validatePatientTreatmentInput,
} from "@/lib/doctor/patient-medication";
import type { CreatePatientTreatmentPayload } from "@/lib/doctor/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PatientMedicationContext = {
  params: Promise<{
    patientId: string;
  }>;
};

export async function POST(
  request: Request,
  context: PatientMedicationContext,
) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const { patientId } = await context.params;
    const parsedPatientId = Number(patientId);

    if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
      return NextResponse.json({ error: "Paciente invalido." }, { status: 400 });
    }

    const payload = (await request.json()) as CreatePatientTreatmentPayload;
    const medication = normalizePatientTreatmentInput(payload);
    const validation = validatePatientTreatmentInput(medication);

    if (validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabase = createAdminSupabaseClient();
    const weeklySchedule =
      medication.weekly_schedule?.is_enabled ? medication.weekly_schedule : null;
    const serializedIntakeSlots = weeklySchedule?.intake_slots.map((slot) => ({
      slot_key: slot.slot_key,
      ...(slot.label ? { label: slot.label } : {}),
      ...(slot.time ? { time: slot.time } : {}),
    }));

    const { data: createdTreatment, error: rpcError } = await supabase.rpc(
      "create_patient_treatment_with_optional_schedule",
      {
        p_patient_id: parsedPatientId,
        p_active_doctor_id: doctor.activeDoctorId,
        p_medication_name: medication.medication_name,
        p_daily_dose: medication.daily_dose,
        p_interval_hours: medication.interval_hours,
        p_pills_per_box: medication.pills_per_box,
        p_box_count: medication.box_count,
        p_start_date: medication.start_date,
        p_schedule_is_enabled: weeklySchedule?.is_enabled ?? null,
        p_schedule_start_date: weeklySchedule?.schedule_start_date ?? null,
        p_schedule_end_date: weeklySchedule?.schedule_end_date ?? null,
        p_days_of_week: weeklySchedule?.days_of_week ?? null,
        p_intake_slots: serializedIntakeSlots ?? null,
        p_schedule_notes: weeklySchedule?.notes ?? null,
      },
    );

    if (rpcError) {
      const mappedError = mapCreateTreatmentError(rpcError.details, rpcError.message);

      return NextResponse.json({ error: mappedError.error }, { status: mappedError.status });
    }

    const createdMedication = Array.isArray(createdTreatment)
      ? createdTreatment[0] ?? null
      : createdTreatment;

    if (!createdMedication?.patient_medication_id) {
      return NextResponse.json(
        { error: "No se pudo crear el tratamiento." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        patient_medication_id: createdMedication.patient_medication_id,
        message: "Tratamiento creado correctamente.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudo crear el tratamiento." },
      { status: 500 },
    );
  }
}

function mapCreateTreatmentError(detail?: string, message?: string) {
  switch (detail) {
    case "patient_not_linked_to_doctor":
      return {
        error: "El paciente no pertenece al medico autenticado.",
        status: 404,
      };
    case "invalid_schedule_interval":
      return {
        error: "Para usar calendario semanal el intervalo debe dividir 24 hs en tomas enteras.",
        status: 400,
      };
    case "weekly_schedule_days_required":
    case "weekly_schedule_invalid_day":
      return {
        error: "Los dias del calendario semanal no son validos.",
        status: 400,
      };
    case "weekly_schedule_slots_required":
      return {
        error: "Agrega al menos una toma en el calendario semanal.",
        status: 400,
      };
    case "weekly_schedule_slots_mismatch":
      return {
        error: "La cantidad de tomas del calendario no coincide con la frecuencia del tratamiento.",
        status: 400,
      };
    case "weekly_schedule_invalid_slot_key":
    case "weekly_schedule_duplicate_slot_key":
      return {
        error: "Las tomas del calendario semanal tienen claves invalidas o repetidas.",
        status: 400,
      };
    case "weekly_schedule_invalid_time":
      return {
        error: "Los horarios del calendario semanal deben tener formato HH:MM.",
        status: 400,
      };
    case "weekly_schedule_end_before_start":
      return {
        error: "La fecha de fin del calendario semanal no puede ser anterior al inicio.",
        status: 400,
      };
    default:
      if (message?.toLowerCase().includes("weekly schedule")) {
        return {
          error: "No se pudo crear el calendario semanal del tratamiento.",
          status: 500,
        };
      }

      return {
        error: "No se pudo crear el tratamiento.",
        status: 500,
      };
  }
}
