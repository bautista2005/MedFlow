"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CircleUserRound,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Stethoscope,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  loginWithPassword,
  resolveLoginIdentifier,
  resolveSessionRole,
} from "@/services/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  notice?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ notice }: LoginFormProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"doctor" | "patient">("doctor");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password) {
      setErrorMessage("Credenciales incorrectas");
      return;
    }

    setIsSubmitting(true);
    setInfoMessage(null);
    setErrorMessage(null);

    let resolvedEmail = normalizedIdentifier;

    if (!emailPattern.test(normalizedIdentifier)) {
      const resolved = await resolveLoginIdentifier({
        identifier: normalizedIdentifier,
      });

      if (resolved.error || !resolved.email) {
        setIsSubmitting(false);
        setErrorMessage("Credenciales incorrectas");
        return;
      }

      resolvedEmail = resolved.email;
    }

    const { data, error } = await loginWithPassword({
      email: resolvedEmail,
      password,
    });

    if (error || !data.session) {
      setIsSubmitting(false);
      setErrorMessage("Credenciales incorrectas");
      return;
    }

    const roleResult = await resolveSessionRole(data.session.access_token);

    if (roleResult.error || !roleResult.role) {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
      const supabase = createBrowserSupabaseClient();

      await supabase.auth.signOut();

      setIsSubmitting(false);
      setErrorMessage("Credenciales incorrectas");
      return;
    }

    if (roleResult.role !== selectedRole) {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
      const supabase = createBrowserSupabaseClient();

      await supabase.auth.signOut();

      setIsSubmitting(false);
      setErrorMessage(
        selectedRole === "doctor"
          ? "Esta cuenta pertenece a un paciente. Cambiá el tipo de usuario para continuar."
          : "Esta cuenta pertenece a un médico. Cambiá el tipo de usuario para continuar.",
      );
      return;
    }

    router.push(roleResult.role === "doctor" ? "/panel" : "/paciente");
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-full border border-slate-200/80 bg-[#ececf3] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSelectedRole("doctor")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:text-xs",
              selectedRole === "doctor"
                ? "bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.10)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Stethoscope className="h-4 w-4" strokeWidth={2.2} />
            Médico
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("patient")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:text-xs",
              selectedRole === "patient"
                ? "bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.10)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <CircleUserRound className="h-4 w-4" strokeWidth={2.2} />
            Paciente
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-2 rounded-[0.8rem] border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] leading-4 text-blue-900 sm:text-xs">
          {notice}
        </div>
      ) : null}
      {infoMessage ? (
        <div className="mt-2 rounded-[0.8rem] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-4 text-slate-600 sm:text-xs">
          {infoMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-2 rounded-[0.8rem] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] leading-4 text-red-700 sm:text-xs">
          {errorMessage}
        </div>
      ) : null}

      <form className="mt-3 space-y-2.5" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <Label htmlFor="identifier" className="text-[11px] font-semibold text-slate-900 sm:text-xs">
            Correo electrónico o DNI
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="identifier"
              name="identifier"
              type="text"
              placeholder={selectedRole === "doctor" ? "doctor@ejemplo.com" : "paciente@ejemplo.com"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] pl-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="password" className="text-[11px] font-semibold text-slate-900 sm:text-xs">
            Contraseña
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] px-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2.1} />
              ) : (
                <Eye className="h-3.5 w-3.5" strokeWidth={2.1} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
          <label className="inline-flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
            />
            Recordarme
          </label>
          <button
            type="button"
            onClick={() =>
              setInfoMessage(
                "La recuperación de contraseña todavía no está disponible desde esta pantalla.",
              )
            }
            className="font-medium text-[#3d72d8] transition hover:text-[#2459c7]"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <Button
          className="h-9 w-full rounded-[0.8rem] bg-[linear-gradient(180deg,_#2d72ff_0%,_#1f5ae8_100%)] text-xs font-semibold shadow-[0_10px_22px_rgba(37,99,235,0.16)] hover:translate-y-0 hover:shadow-[0_12px_24px_rgba(37,99,235,0.2)]"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Iniciando sesión..."
            : `Iniciar sesión como ${selectedRole === "doctor" ? "médico" : "paciente"}`}
        </Button>
      </form>

      <div className="mt-3 text-center text-[11px] text-slate-500 sm:text-xs">
        ¿Eres un médico nuevo?{" "}
        <Link
          href="/registro-medico"
          className="font-semibold text-[#3d72d8] transition hover:text-[#2459c7]"
        >
          Solicitar acceso
        </Link>
      </div>

    </div>
  );
}
