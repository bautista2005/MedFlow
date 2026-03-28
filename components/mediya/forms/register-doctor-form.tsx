"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { registerDoctor } from "@/services/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="px-0 pb-0">
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              name="dni"
              inputMode="numeric"
              placeholder="30111222"
              value={form.dni}
              onChange={(event) => updateField("dni", event.target.value)}
              aria-invalid={Boolean(errors.dni)}
              className={cn(
                "h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12",
                errors.dni && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
            {errors.dni ? (
              <p className="text-sm text-red-600">{errors.dni}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="medico@medflow.app"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              className={cn(
                "h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12",
                errors.email && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
            {errors.email ? (
              <p className="text-sm text-red-600">{errors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+54 11 5555 5555"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              className={cn(
                "h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12",
                errors.phone && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
            {errors.phone ? (
              <p className="text-sm text-red-600">{errors.phone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Creá una contraseña"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              aria-invalid={Boolean(errors.password)}
              className={cn(
                "h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12",
                errors.password && "border-red-300 ring-4 ring-red-500/10",
              )}
            />
            {errors.password ? (
              <p className="text-sm text-red-600">{errors.password}</p>
            ) : null}
          </div>

          {status.type !== "idle" ? (
            <div
              className={cn(
                "rounded-[1rem] border px-4 py-3 text-sm leading-6",
                status.type === "error" &&
                  "border-red-200 bg-red-50 text-red-700",
                status.type === "success" &&
                  "border-blue-200 bg-blue-50 text-blue-900",
              )}
            >
              {status.message}
            </div>
          ) : null}

          <div>
            <Button
              className="h-12 w-full rounded-[1rem] bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)] shadow-[0_16px_32px_rgba(37,99,235,0.22)] hover:shadow-[0_20px_38px_rgba(37,99,235,0.28)]"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Validando médico aprobado..." : "Crear cuenta médica"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="mt-5 flex-col items-start gap-2 px-0 pb-0 text-sm text-slate-500">
        <p>
          Si el alta sale bien, te redirigimos automáticamente al login para
          iniciar sesión.
        </p>
      </CardFooter>
    </Card>
  );
}
