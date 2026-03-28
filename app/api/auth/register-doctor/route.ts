import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RegisterDoctorRequest = {
  dni?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const isDevelopment = process.env.NODE_ENV !== "production";

function validatePayload(payload: RegisterDoctorRequest) {
  const dni = payload.dni?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const phone = payload.phone?.trim() ?? "";
  const password = payload.password ?? "";

  if (!/^\d{7,10}$/.test(dni)) {
    return { error: "Ingresá un DNI válido.", status: 400 };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ingresá un email válido.", status: 400 };
  }

  if (phone.length < 8) {
    return { error: "Ingresá un teléfono válido.", status: 400 };
  }

  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres.",
      status: 400,
    };
  }

  return {
    data: {
      dni,
      email,
      phone,
      password,
    },
  };
}

function mapRegistrationError(message?: string, detail?: string) {
  if (detail === "dni_not_found") {
    return {
      error: "El DNI no pertenece a un médico aprobado.",
      status: 404,
    };
  }

  if (detail === "doctor_already_claimed") {
    return {
      error: "Este médico ya fue reclamado y no puede registrarse otra vez.",
      status: 409,
    };
  }

  if (detail === "doctor_not_approved") {
    return {
      error: "El médico existe pero no está aprobado para registrarse.",
      status: 403,
    };
  }

  if (detail === "doctor_registration_conflict") {
    return {
      error: "No se pudo completar el registro porque el médico ya fue tomado o el email está en uso.",
      status: 409,
    };
  }

  if (message?.toLowerCase().includes("already registered")) {
    return {
      error: "El email ya está en uso.",
      status: 409,
    };
  }

  return {
    error: "No se pudo completar el registro del médico.",
    status: 500,
  };
}

function buildDebugPayload(context: string, error: unknown) {
  if (!isDevelopment) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      context,
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return {
      context,
      ...error,
    };
  }

  return {
    context,
    value: String(error),
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RegisterDoctorRequest;
    const validation = validatePayload(payload);

    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { dni, email, phone, password } = validation.data;
    const supabase = createAdminSupabaseClient();

    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "doctor",
        },
        app_metadata: {
          role: "doctor",
        },
      });

    if (createUserError || !createdUser.user) {
      console.error("register-doctor createUser failed", {
        message: createUserError?.message,
        status: createUserError?.status,
        code: createUserError?.code,
        dni,
        email,
      });

      const mapped = mapRegistrationError(createUserError?.message);
      return NextResponse.json(
        {
          error: mapped.error,
          debug: buildDebugPayload("create_user", {
            message: createUserError?.message,
            status: createUserError?.status,
            code: createUserError?.code,
          }),
        },
        { status: mapped.status },
      );
    }

    const { data: claimData, error: claimError } = await supabase.rpc(
      "claim_approved_doctor_registration",
      {
        p_auth_user_id: createdUser.user.id,
        p_dni: dni,
        p_email: email,
        p_phone: phone,
        p_type: "obra_social",
      },
    );

    if (claimError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);

      console.error("register-doctor claim RPC failed", {
        message: claimError.message,
        details: claimError.details,
        hint: claimError.hint,
        code: claimError.code,
        dni,
        email,
        authUserId: createdUser.user.id,
      });

      const mapped = mapRegistrationError(claimError.message, claimError.details);
      return NextResponse.json(
        {
          error: mapped.error,
          debug: buildDebugPayload("claim_approved_doctor_registration", {
            message: claimError.message,
            details: claimError.details,
            hint: claimError.hint,
            code: claimError.code,
          }),
        },
        { status: mapped.status },
      );
    }

    return NextResponse.json(
      {
        message: "Cuenta médica creada correctamente.",
        data: claimData,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("register-doctor route failed", error);

    return NextResponse.json(
      {
        error: "No se pudo completar el registro del médico.",
        debug: buildDebugPayload("route_handler", error),
      },
      { status: 500 },
    );
  }
}
