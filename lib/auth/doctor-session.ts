import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class DoctorSessionError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "DoctorSessionError";
    this.status = status;
  }
}

export type AuthenticatedDoctor = {
  authUserId: string;
  activeDoctorId: number;
  name: string;
  email: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function requireAuthenticatedDoctor(
  request: Request,
): Promise<AuthenticatedDoctor> {
  const token = getBearerToken(request);

  if (!token) {
    throw new DoctorSessionError("Unauthorized", 401);
  }

  const publicSupabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await publicSupabase.auth.getUser(token);

  if (userError || !user) {
    throw new DoctorSessionError("Unauthorized", 401);
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: doctor, error: doctorError } = await adminSupabase
    .from("active_doctors")
    .select("active_doctor_id, name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorError) {
    throw new DoctorSessionError("No se pudo validar la sesion del medico.", 500);
  }

  if (!doctor) {
    throw new DoctorSessionError("La cuenta autenticada no pertenece a un medico.", 403);
  }

  return {
    authUserId: user.id,
    activeDoctorId: doctor.active_doctor_id,
    name: doctor.name,
    email: doctor.email,
  };
}
