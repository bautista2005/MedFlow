"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronRight, Plus, UsersRound } from "lucide-react";

import type { DoctorRequestsResponse, PatientsIndexResponse } from "@/lib/doctor/types";
import { listDoctorPatients, listDoctorRequests } from "@/services/doctor/doctor-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  patients: PatientsIndexResponse | null;
  requests: DoctorRequestsResponse | null;
};

const requestStatusLabel: Record<DoctorRequestsResponse["requests"][number]["status"], string> = {
  pending: "Pedido nuevo",
  reviewed: "En revisión",
  accepted: "Aceptado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

function getPendingRequestCount(
  patientId: number,
  requests: DoctorRequestsResponse["requests"],
) {
  return requests.filter(
    (request) =>
      request.patient_id === patientId &&
      (request.status === "pending" || request.status === "reviewed"),
  ).length;
}

const accountStatusLabel: Record<string, string> = {
  active: "Activo",
  invited: "Invitado",
  disabled: "Deshabilitado",
};

export function DoctorDashboardOverview() {
  const [data, setData] = useState<DashboardData>({
    patients: null,
    requests: null,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const [patients, requests] = await Promise.all([
          listDoctorPatients(),
          listDoctorRequests(),
        ]);

        setData({ patients, requests });
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el panel médico.",
        );
      }
    }

    load();
  }, []);

  const pendingRequests = useMemo(
    () =>
      (data.requests?.requests ?? []).filter(
        (request) => request.status === "pending" || request.status === "reviewed",
      ),
    [data.requests],
  );

  const sortedPatients = useMemo(
    () =>
      [...(data.patients?.patients ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "es-AR", { sensitivity: "base" }),
      ),
    [data.patients],
  );
  const availableLetters = useMemo(
    () =>
      Array.from(
        new Set(
          sortedPatients.map((patient) =>
            patient.name.trim().charAt(0).toUpperCase(),
          ),
        ),
      ),
    [sortedPatients],
  );
  const visiblePatients = useMemo(
    () =>
      selectedLetter === "all"
        ? sortedPatients
        : sortedPatients.filter(
            (patient) => patient.name.trim().charAt(0).toUpperCase() === selectedLetter,
          ),
    [selectedLetter, sortedPatients],
  );
  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[22px] border border-blue-100 bg-[linear-gradient(135deg,_rgba(37,99,235,0.10),_rgba(59,130,246,0.04)_55%,_rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_22px_50px_rgba(37,99,235,0.10)] md:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Panel médico
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            Gestión clínica diaria
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Centralizá pacientes, solicitudes de receta y seguimiento del tratamiento desde una
            interfaz clínica consistente.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-50 text-blue-700">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Clientes
                </p>
                <p className="text-2xl font-semibold text-slate-900">
                  {data.patients?.patients.length ?? 0}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-50 text-blue-700">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Pendientes
                </p>
                <p className="text-2xl font-semibold text-slate-900">{pendingRequests.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.86fr]">
        <section className="space-y-4">
          <Card className="border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <CardHeader className="pb-4">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Clientes
                    </p>
                    <CardTitle className="font-sans text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-900">
                      Pacientes asociados
                    </CardTitle>
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/panel/pacientes">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar cliente
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLetter("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedLetter === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    Todas
                  </button>
                  {availableLetters.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setSelectedLetter(letter)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selectedLetter === letter
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {errorMessage ? (
                <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              {!errorMessage && !data.patients ? (
                <p className="text-sm text-slate-500">Cargando clientes...</p>
              ) : null}

              {data.patients?.patients.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay pacientes asociados.</p>
              ) : null}

              <div className="space-y-3">
                {visiblePatients.map((patient) => {
                  const pendingCount = getPendingRequestCount(
                    patient.patient_id,
                    data.requests?.requests ?? [],
                  );

                  return (
                    <Link
                      key={patient.patient_id}
                      href={`/panel/pacientes/${patient.patient_id}`}
                      className={`group relative block w-full rounded-[18px] px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(37,99,235,0.12)] ${
                        pendingCount > 0
                          ? "border border-blue-300 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(248,250,252,0.98))] ring-2 ring-blue-200/70 hover:border-blue-400"
                          : "border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] hover:border-blue-200"
                      }`}
                    >
                      {pendingCount > 0 ? (
                        <span className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)]">
                          {pendingCount}
                        </span>
                      ) : null}

                      <div className="pr-8">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                            {accountStatusLabel[patient.account_status] ?? patient.account_status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                          DNI
                        </p>
                        <p className="text-sm text-slate-500">{patient.dni}</p>
                        {pendingCount > 0 ? (
                          <p className="mt-2 text-xs font-medium text-blue-700">
                            Tiene notificaciones pendientes
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>Ver detalle</span>
                        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside>
          <Card className="sticky top-8 border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-sans text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-900">
                  Notificaciones
                </CardTitle>
                <Badge className="border-red-200 bg-red-50 text-red-700">
                  {pendingRequests.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data.requests && !errorMessage ? (
                <p className="text-sm text-slate-500">Cargando notificaciones...</p>
              ) : null}

              {pendingRequests.length === 0 && data.requests ? (
                <p className="text-sm text-slate-500">
                  No hay pedidos pendientes por ahora.
                </p>
              ) : null}

              {pendingRequests.map((request) => (
                <Link
                  key={request.prescription_request_id}
                  href={`/panel/pacientes/${request.patient_id}`}
                  className="block rounded-[18px] border border-slate-200 bg-white px-5 py-5 shadow-[0_12px_26px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-blue-200 hover:bg-blue-50/35 hover:shadow-[0_18px_34px_rgba(37,99,235,0.10)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{request.patient_name}</p>
                      <p className="text-sm text-slate-500">{request.medication_name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(request.requested_at).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <Badge className="border-blue-200 bg-white text-blue-700">
                      {requestStatusLabel[request.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
