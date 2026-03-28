"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  loginWithPassword,
  resolveLoginIdentifier,
  resolveSessionRole,
} from "@/services/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  notice?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ notice }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password) {
      setErrorMessage("Credenciales incorrectas");
      return;
    }

    setIsSubmitting(true);
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

    router.push(roleResult.role === "doctor" ? "/panel" : "/paciente");
    router.refresh();
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="px-0 pb-0">
        {notice ? (
          <div
            className={cn(
              "mb-6 rounded-[1rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900",
            )}
          >
            {notice}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mb-6 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        ) : null}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="identifier">Email o DNI</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="medico@medflow.app o 30111222"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-[1rem] border-slate-200 bg-slate-50 text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/12"
            />
          </div>
          <Button
            className="h-12 w-full rounded-[1rem] bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)] shadow-[0_16px_32px_rgba(37,99,235,0.22)] hover:shadow-[0_20px_38px_rgba(37,99,235,0.28)]"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="mt-5 flex-col items-start gap-2 px-0 pb-0 text-sm text-slate-500">
        <p>
          Médicos y pacientes usan el mismo acceso. Si ingresás un DNI, MedFlow
          resuelve primero el email asociado.
        </p>
      </CardFooter>
    </Card>
  );
}
