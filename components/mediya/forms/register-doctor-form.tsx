"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, IdCard, LockKeyhole, Mail, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import { registerDoctor } from "@/services/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  dni: string;
  email: string;
  phone: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialFormState: FormState = {
  dni: "",
  email: "",
  phone: "",
  password: "",
};

function validateForm(values: FormState) {
  const errors: FormErrors = {};

  if (!/^\d{7,10}$/.test(values.dni.trim())) {
    errors.dni = "Ingresá un DNI válido sin puntos.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Ingresá un email válido.";
  }

  if (values.phone.trim().length < 8) {
    errors.phone = "Ingresá un teléfono válido.";
  }

  if (values.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }

  return errors;
}

export function RegisterDoctorForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "error" | "success";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus({ type: "idle", message: "" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus({
        type: "error",
        message: "Revisá los campos marcados antes de continuar.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    const result = await registerDoctor(form);

    setIsSubmitting(false);

    if (result.error) {
      setStatus({
        type: "error",
        message: result.error,
      });
      return;
    }

    setForm(initialFormState);
    setStatus({
      type: "success",
      message:
        result.message ??
        "Cuenta médica creada correctamente. Ya podés iniciar sesión.",
    });

    window.setTimeout(() => {
      router.push("/login?registered=1");
    }, 1200);
  }

  return (
    <div>
      <div className="rounded-[0.8rem] border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] leading-4 text-blue-900 sm:text-xs">
        El registro está habilitado solo para médicos aprobados. Si sos paciente, tu médico debe
        darte de alta en el sistema.
      </div>

      <form className="mt-3 grid gap-2.5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1">
          <Label htmlFor="dni" className="text-[11px] font-semibold text-slate-900 sm:text-xs">
            DNI
          </Label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="dni"
              name="dni"
              inputMode="numeric"
              placeholder="30111222"
              value={form.dni}
              onChange={(event) => updateField("dni", event.target.value)}
              aria-invalid={Boolean(errors.dni)}
              className={cn(
                "h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] pl-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10",
                errors.dni && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
          </div>
          {errors.dni ? <p className="text-[11px] text-red-600">{errors.dni}</p> : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className="text-[11px] font-semibold text-slate-900 sm:text-xs">
            Email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="medico@medflow.app"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              className={cn(
                "h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] pl-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10",
                errors.email && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
          </div>
          {errors.email ? <p className="text-[11px] text-red-600">{errors.email}</p> : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone" className="text-[11px] font-semibold text-slate-900 sm:text-xs">
            Teléfono
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+54 11 5555 5555"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              className={cn(
                "h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] pl-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10",
                errors.phone && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
          </div>
          {errors.phone ? <p className="text-[11px] text-red-600">{errors.phone}</p> : null}
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="password"
            className="text-[11px] font-semibold text-slate-900 sm:text-xs"
          >
            Contraseña
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Creá una contraseña"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              aria-invalid={Boolean(errors.password)}
              className={cn(
                "h-9 rounded-[0.8rem] border-slate-200 bg-[#f4f5f9] px-9 text-xs text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-blue-500/10",
                errors.password && "border-red-300 ring-4 ring-red-500/10",
              )}
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
          {errors.password ? <p className="text-[11px] text-red-600">{errors.password}</p> : null}
        </div>

        {status.type !== "idle" ? (
          <div
            className={cn(
              "rounded-[0.8rem] border px-2.5 py-1.5 text-[11px] leading-4",
              status.type === "error" && "border-red-200 bg-red-50 text-red-700",
              status.type === "success" && "border-blue-200 bg-blue-50 text-blue-900",
            )}
          >
            {status.message}
          </div>
        ) : null}

        <Button
          className="h-9 w-full rounded-[0.8rem] bg-[linear-gradient(180deg,_#2d72ff_0%,_#1f5ae8_100%)] text-xs font-semibold shadow-[0_10px_22px_rgba(37,99,235,0.16)] hover:translate-y-0 hover:shadow-[0_12px_24px_rgba(37,99,235,0.2)]"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Validando médico aprobado..." : "Crear cuenta médica"}
        </Button>
      </form>

      <div className="mt-3 text-center text-[11px] text-slate-500 sm:text-xs">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-[#3d72d8] transition hover:text-[#2459c7]">
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
