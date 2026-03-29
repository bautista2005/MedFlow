"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import type { DoctorRequestsResponse, PatientsIndexResponse } from "@/lib/doctor/types";
import { listDoctorPatients, listDoctorRequests } from "@/services/doctor/doctor-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  patients: PatientsIndexResponse | null;
  requests: DoctorRequestsResponse | null;
};

function requiresDoctorAction(status: DoctorRequestsResponse["requests"][number]["status"]) {
  return status === "pending" || status === "reviewed";
}

function getPendingRequestCount(
  patientId: number,
  requests: DoctorRequestsResponse["requests"],
) {
  return requests.filter(
    (request) => request.patient_id === patientId && requiresDoctorAction(request.status),
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
      (data.requests?.requests ?? []).filter((request) => requiresDoctorAction(request.status)),
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
      <section className="rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(247,250,255,0.96))] px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Panel médico
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">
              Gestión clínica diaria
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Tenés{" "}
              <span className="font-semibold text-blue-700">
                {data.patients?.patients.length ?? 0} paciente
                {(data.patients?.patients.length ?? 0) === 1 ? "" : "s"} asociado
                {(data.patients?.patients.length ?? 0) === 1 ? "" : "s"}
              </span>{" "}
              y{" "}
              <span className="font-semibold text-blue-700">
                {pendingRequests.length} solicitud{pendingRequests.length === 1 ? "" : "es"}
              </span>{" "}
              que todavía requieren acción médica.
            </p>
          </div>
          <Button asChild className="w-full rounded-[0.95rem] sm:w-auto">
            <Link href="/panel/pacientes">
              <Plus className="mr-2 h-4 w-4" />
              Agregar paciente
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <Card className="border-white/70 bg-white/92 shadow-[0_20px_56px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-4">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Pacientes
                  </p>
                  <CardTitle className="font-sans text-[1.35rem] font-semibold tracking-[-0.03em] text-slate-900">
                    Pacientes asociados
                  </CardTitle>
                </div>
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
              <p className="text-sm text-slate-500">Cargando pacientes...</p>
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
                const followUpCount = patient.follow_up_notification_count;
                const isUrgent = patient.risk_status === "critical";
                const notificationCount = pendingCount + followUpCount;
                const hasPendingNotifications = notificationCount > 0;
                const cardClassName = isUrgent
                  ? "border border-rose-300 bg-[linear-gradient(180deg,_rgba(255,241,242,0.98),_rgba(255,255,255,0.98))] ring-1 ring-rose-200/80 hover:border-rose-400 hover:shadow-[0_14px_28px_rgba(244,63,94,0.12)]"
                  : hasPendingNotifications
                    ? "border border-blue-300 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(248,250,252,0.98))] ring-1 ring-blue-200/70 hover:border-blue-400"
                    : "border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] hover:border-blue-200";
                const badgeClassName = isUrgent
                  ? "bg-rose-600 shadow-[0_8px_20px_rgba(244,63,94,0.22)]"
                  : "bg-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.22)]";
                const badgeLabel =
                  isUrgent && notificationCount === 0 ? "!" : String(notificationCount);
                const helperText = isUrgent
                  ? "Requiere atención urgente"
                  : pendingCount > 0 && followUpCount > 0
                    ? "Tiene pedidos y seguimientos pendientes"
                    : pendingCount > 0
                      ? "Requiere revisión médica"
                      : followUpCount > 0
                        ? "Tiene seguimiento del chatbot pendiente"
                        : null;

                return (
                  <Link
                    key={patient.patient_id}
                    href={`/panel/pacientes/${patient.patient_id}`}
                    className={`group relative block w-full rounded-[16px] px-5 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 ${cardClassName}`}
                  >
                    {isUrgent || hasPendingNotifications ? (
                      <span
                        className={`absolute right-4 top-4 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${badgeClassName}`}
                      >
                        {badgeLabel}
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
                      {helperText ? (
                        <p
                          className={`mt-2 text-xs font-medium ${
                            isUrgent ? "text-rose-700" : "text-blue-700"
                          }`}
                        >
                          {helperText}
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
    </div>
  );
}
