import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class PatientSessionError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "PatientSessionError";
    this.status = status;
  }
}

export type AuthenticatedPatient = {
  authUserId: string;
  patientId: number;
  name: string;
  email: string;
  preferredPharmacyId: number | null;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function requireAuthenticatedPatient(
  request: Request,
): Promise<AuthenticatedPatient> {
  const token = getBearerToken(request);

  if (!token) {
    throw new PatientSessionError("Unauthorized", 401);
  }

  const publicSupabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await publicSupabase.auth.getUser(token);

  if (userError || !user) {
    throw new PatientSessionError("Unauthorized", 401);
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: patient, error: patientError } = await adminSupabase
    .from("patients")
    .select("patient_id, name, email, preferred_pharmacy_id, account_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (patientError) {
    throw new PatientSessionError("No se pudo validar la sesion del paciente.", 500);
  }

  if (!patient) {
    throw new PatientSessionError(
      "La cuenta autenticada no pertenece a un paciente.",
      403,
    );
  }

  if (patient.account_status === "disabled") {
    throw new PatientSessionError(
      "La cuenta del paciente no se encuentra activa.",
      403,
    );
  }

  let resolvedPatient = patient;

  if (patient.account_status === "invited") {
    const { data: activatedPatient, error: activationError } = await adminSupabase
      .from("patients")
      .update({
        account_status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("patient_id", patient.patient_id)
      .select("patient_id, name, email, preferred_pharmacy_id, account_status")
      .single();

    if (activationError || !activatedPatient) {
      throw new PatientSessionError(
        "No se pudo activar la cuenta del paciente.",
        500,
      );
    }

    resolvedPatient = activatedPatient;
  }

  return {
    authUserId: user.id,
    patientId: resolvedPatient.patient_id,
    name: resolvedPatient.name,
    email: resolvedPatient.email,
    preferredPharmacyId: resolvedPatient.preferred_pharmacy_id,
  };
}
