export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginIdentifierPayload = {
  identifier: string;
};

export type RegisterDoctorPayload = {
  dni: string;
  email: string;
  phone: string;
  password: string;
};

export async function loginWithPassword({ email, password }: LoginPayload) {
  const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
  const supabase = createBrowserSupabaseClient();

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function resolveLoginIdentifier({
  identifier,
}: LoginIdentifierPayload) {
  const response = await fetch("/api/auth/resolve-login-identifier", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier }),
  });

  const result = (await response.json()) as {
    email?: string;
    error?: string;
    source?: "email" | "doctor" | "patient";
  };

  if (!response.ok || !result.email) {
    return {
      email: null,
      error: result.error ?? "Credenciales incorrectas",
      source: null,
    };
  }

  return {
    email: result.email,
    error: null,
    source: result.source ?? null,
  };
}

export async function resolveSessionRole(accessToken: string) {
  const response = await fetch("/api/auth/session-role", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const result = (await response.json()) as {
    role?: "doctor" | "patient";
    error?: string;
  };

  if (!response.ok || !result.role) {
    return {
      role: null,
      error: result.error ?? "No se pudo validar la cuenta.",
    };
  }

  return {
    role: result.role,
    error: null,
  };
}

export async function registerDoctor(payload: RegisterDoctorPayload) {
  const response = await fetch("/api/auth/register-doctor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as {
    error?: string;
    message?: string;
    data?: unknown;
  };

  if (!response.ok) {
    return {
      data: null,
      error: result.error ?? "No se pudo completar el registro.",
    };
  }

  return {
    data: result.data ?? null,
    error: null,
    message: result.message,
  };
}
