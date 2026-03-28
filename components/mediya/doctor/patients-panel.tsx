"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import type { CreatePatientPayload, PatientsIndexResponse } from "@/lib/doctor/types";
import { createDoctorPatient, listDoctorPatients } from "@/services/doctor/doctor-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const emptyForm: CreatePatientPayload = {
  name: "",
  dni: "",
  email: "",
  phone: "",
  address: "",
  zone: "",
  preferred_pharmacy_id: null,
  password: "",
  medications: [],
};

export function PatientsPanel() {
  const [data, setData] = useState<PatientsIndexResponse | null>(null);
  const [form, setForm] = useState<CreatePatientPayload>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await listDoctorPatients();
        setData(result);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar pacientes.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  function updateField<K extends keyof CreatePatientPayload>(
    field: K,
    value: CreatePatientPayload[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createDoctorPatient(form);
      const refreshed = await listDoctorPatients();

      setData(refreshed);
      setForm(emptyForm);
      setSuccessMessage("Paciente registrado exitosamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear el paciente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/panel"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
        aria-label="Volver al panel"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="rounded-[22px] border border-blue-100 bg-[linear-gradient(135deg,_rgba(37,99,235,0.10),_rgba(59,130,246,0.04)_55%,_rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_22px_50px_rgba(37,99,235,0.10)] md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Alta de pacientes
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
          Nuevo paciente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Registrá la cuenta, datos de contacto y farmacia preferida sin alterar el flujo
          actual del sistema.
        </p>
      </div>

      <Card className="mx-auto w-full max-w-3xl border-white/70 bg-white/92 shadow-[0_28px_100px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <CardTitle>Datos del paciente</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="mb-4 text-sm text-muted-foreground">Cargando...</p> : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ana Perez"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={form.dni}
                  onChange={(event) => updateField("dni", event.target.value)}
                  placeholder="30111222"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="paciente@mediya.app"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="+54 11 5555 5555"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone">Zona</Label>
                <Input
                  id="zone"
                  value={form.zone}
                  onChange={(event) => updateField("zone", event.target.value)}
                  placeholder="Caballito"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Direccion</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                placeholder="Av. Rivadavia 1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy">Farmacia preferida</Label>
              <select
                id="pharmacy"
                value={form.preferred_pharmacy_id ?? ""}
                onChange={(event) =>
                  updateField(
                    "preferred_pharmacy_id",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className={cn(
                  "flex h-12 w-full rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/12",
                )}
              >
                <option value="">Sin preferencia</option>
                {data?.pharmacies.map((pharmacy) => (
                  <option key={pharmacy.pharmacy_id} value={pharmacy.pharmacy_id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena temporal</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {successMessage}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando cuenta..." : "Crear paciente"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
