import { NextResponse } from "next/server";

import { requireAuthenticatedDoctor, DoctorSessionError } from "@/lib/auth/doctor-session";
import {
  normalizePatientMedicationInput,
  validatePatientMedicationInput,
} from "@/lib/doctor/patient-medication";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  CreatePatientPayload,
  PatientSummary,
  PharmacySummary,
} from "@/lib/doctor/types";

export const runtime = "nodejs";

const dniPattern = /^\d{7,10}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PatientRow = {
  is_primary: boolean;
  patients: PatientRelation | PatientRelation[];
};

type PatientRelation = {
  patient_id: number;
  name: string;
  dni: string;
  email: string;
  phone: string | null;
  zone: string | null;
  account_status: "invited" | "active" | "disabled";
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

function normalizePharmacy(pharmacy: PatientRelation["pharmacies"]): PharmacySummary | null {
  if (!pharmacy) {
    return null;
  }

  return Array.isArray(pharmacy) ? pharmacy[0] ?? null : pharmacy;
}

function mapPatientRow(row: PatientRow): PatientSummary {
  const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;

  if (!patient) {
    throw new Error("Invalid patient relation.");
  }

  return {
    patient_id: patient.patient_id,
    name: patient.name,
    dni: patient.dni,
    email: patient.email,
    phone: patient.phone,
    zone: patient.zone,
    account_status: patient.account_status,
    is_primary: row.is_primary,
    preferred_pharmacy: normalizePharmacy(patient.pharmacies),
  };
}

function validateCreatePatientPayload(payload: CreatePatientPayload) {
  const name = payload.name?.trim() ?? "";
  const dni = payload.dni?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const phone = payload.phone?.trim() ?? null;
  const address = payload.address?.trim() ?? null;
  const zone = payload.zone?.trim() ?? null;
  const password = payload.password ?? "";
  const preferredPharmacyId = payload.preferred_pharmacy_id ?? null;
  const medications = (payload.medications ?? [])
    .map(normalizePatientMedicationInput)
    .filter((medication) => medication.medication_name.length > 0);

  if (!name) {
    return { error: "Ingresa el nombre completo.", status: 400 };
  }

  if (!dniPattern.test(dni)) {
    return { error: "Ingresa un DNI valido.", status: 400 };
  }

  if (!emailPattern.test(email)) {
    return { error: "Ingresa un email valido.", status: 400 };
  }

  if (phone && phone.length < 8) {
    return { error: "Ingresa un telefono valido.", status: 400 };
  }

  if (password.length < 8) {
    return {
      error: "La contrasena temporal debe tener al menos 8 caracteres.",
      status: 400,
    };
  }

  const invalidMedication = medications
    .map(validatePatientMedicationInput)
    .find((result) => result !== null);

  if (invalidMedication) {
    return invalidMedication;
  }

  return {
    data: {
      name,
      dni,
      email,
      phone,
      address,
      zone,
      password,
      preferredPharmacyId,
      medications,
    },
  };
}

export async function GET(request: Request) {
  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const supabase = createAdminSupabaseClient();

    const [{ data: patientRows, error: patientsError }, { data: pharmacies, error: pharmaciesError }] =
      await Promise.all([
        supabase
          .from("patient_doctors")
          .select(
            "is_primary, patients!inner(patient_id, name, dni, email, phone, zone, account_status, pharmacies(pharmacy_id, name, zone, city))",
          )
          .eq("active_doctor_id", doctor.activeDoctorId)
          .order("created_at", { ascending: false }),
        supabase
          .from("pharmacies")
          .select("pharmacy_id, name, zone, city")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

    if (patientsError || pharmaciesError) {
      return NextResponse.json(
        { error: "No se pudieron cargar los pacientes del medico." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      doctor: {
        name: doctor.name,
        email: doctor.email,
      },
      patients: ((patientRows ?? []) as unknown as PatientRow[]).map(mapPatientRow),
      pharmacies: (pharmacies ?? []) as PharmacySummary[],
    });
  } catch (error) {
    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "No se pudieron cargar los pacientes del medico." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const doctor = await requireAuthenticatedDoctor(request);
    const payload = (await request.json()) as CreatePatientPayload;
    const validation = validateCreatePatientPayload(payload);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const {
      name,
      dni,
      email,
      phone,
      address,
      zone,
      password,
      preferredPharmacyId,
      medications,
    } = validation.data;
    const supabase = createAdminSupabaseClient();

    const [{ data: existingDni }, { data: existingEmail }] = await Promise.all([
      supabase.from("patients").select("patient_id").eq("dni", dni).maybeSingle(),
      supabase.from("patients").select("patient_id").eq("email", email).maybeSingle(),
    ]);

    if (existingDni) {
      return NextResponse.json(
        { error: "Ya existe un paciente con ese DNI." },
        { status: 409 },
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        { error: "Ya existe un paciente con ese email." },
        { status: 409 },
      );
    }

    if (preferredPharmacyId) {
      const { data: pharmacy } = await supabase
        .from("pharmacies")
        .select("pharmacy_id")
        .eq("pharmacy_id", preferredPharmacyId)
        .eq("is_active", true)
        .maybeSingle();

      if (!pharmacy) {
        return NextResponse.json(
          { error: "La farmacia seleccionada no esta disponible." },
          { status: 400 },
        );
      }
    }

    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "patient",
        },
        app_metadata: {
          role: "patient",
        },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "No se pudo crear la cuenta del paciente." },
        { status: 500 },
      );
    }

    createdUserId = createdUser.user.id;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        auth_user_id: createdUserId,
        name,
        dni,
        email,
        phone,
        address,
        zone,
        preferred_pharmacy_id: preferredPharmacyId,
        created_by_active_doctor_id: doctor.activeDoctorId,
        account_status: "invited",
      })
      .select("patient_id")
      .single();

    if (patientError || !patient) {
      throw new Error(patientError?.message ?? "No se pudo crear el perfil del paciente.");
    }

    const { error: relationshipError } = await supabase
      .from("patient_doctors")
      .insert({
        patient_id: patient.patient_id,
        active_doctor_id: doctor.activeDoctorId,
        is_primary: true,
        role: "primary",
      });

    if (relationshipError) {
      throw new Error(relationshipError.message);
    }

    if (medications.length > 0) {
      const { error: medicationsError } = await supabase
        .from("patient_medications")
        .insert(
          medications.map((medication) => ({
            patient_id: patient.patient_id,
            active_doctor_id: doctor.activeDoctorId,
            ...medication,
          })),
        );

      if (medicationsError) {
        throw new Error(medicationsError.message);
      }
    }

    return NextResponse.json(
      {
        patient_id: patient.patient_id,
        message: "Paciente creado correctamente y vinculado al medico.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdUserId) {
      const supabase = createAdminSupabaseClient();
      await supabase.auth.admin.deleteUser(createdUserId);
    }

    if (error instanceof DoctorSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el paciente.",
      },
      { status: 500 },
    );
  }
}
