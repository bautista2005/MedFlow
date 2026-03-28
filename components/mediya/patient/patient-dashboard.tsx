"use client";

import { useEffect, useState } from "react";
import { ClipboardList, HeartPulse } from "lucide-react";

import type { CreatePatientRequestPayload, PatientDashboardResponse } from "@/lib/patient/types";
import {
  createPatientRequest,
  getPatientDashboard,
} from "@/services/patient/patient-service";
import { PatientEmptyState } from "@/components/mediya/patient/patient-empty-state";
import { PatientRequestTracker } from "@/components/mediya/patient/patient-request-tracker";
import { PatientTreatmentCard } from "@/components/mediya/patient/patient-treatment-card";
import { PatientWeeklyCalendar } from "@/components/mediya/patient/patient-weekly-calendar";

export function PatientDashboard() {
  const [data, setData] = useState<PatientDashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  async function refresh() {
    const result = await getPatientDashboard();
    setData(result);
  }

  useEffect(() => {
    refresh().catch((error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el panel.",
      );
    });
  }, []);

  async function handleRequestRefill(payload: CreatePatientRequestPayload) {
    setRequestingId(payload.patient_medication_id);
    setErrorMessage(null);

    try {
      await createPatientRequest(payload);
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear el pedido.",
      );
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[22px] border border-blue-100 bg-[linear-gradient(135deg,_rgba(37,99,235,0.10),_rgba(59,130,246,0.04)_55%,_rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_22px_50px_rgba(37,99,235,0.10)] md:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Panel del paciente
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            Hola, {data?.patient.name ?? "Paciente"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Acá podés revisar tus tratamientos, ver el estado de tus pedidos y seguir la
            disponibilidad de reposición desde un mismo lugar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-50 text-blue-700">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Tratamientos
                </p>
                <p className="text-2xl font-semibold text-slate-900">
                  {data?.medications.length ?? 0}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-50 text-blue-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Pedidos
                </p>
                <p className="text-2xl font-semibold text-slate-900">
                  {data?.requests.length ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.05)] md:p-4">
            <div className="rounded-[18px] border border-blue-100 bg-[linear-gradient(180deg,_#ffffff,_#f5f9ff)] p-5 md:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Mis tratamientos
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                    Seguimiento activo
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Visualizá la medicación cargada por tu médico y el estado de reposición de
                    cada tratamiento.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {data?.medications.length ? (
                  data.medications.map((medication) => (
                    <PatientTreatmentCard
                      key={medication.patient_medication_id}
                      medication={medication}
                      isSubmitting={requestingId === medication.patient_medication_id}
                      onRequestRefill={handleRequestRefill}
                    />
                  ))
                ) : (
                  <PatientEmptyState
                    title="Todavía no tenés tratamientos"
                    description="Cuando tu médico cargue un tratamiento, vas a poder verlo acá junto con el estado de reposición."
                    variant="treatments"
                  />
                )}
              </div>
            </div>
          </div>

          <PatientWeeklyCalendar hasTreatments={Boolean(data?.medications.length)} />
        </div>

        <div>
          {data?.requests.length ? (
            <PatientRequestTracker requests={data.requests} />
          ) : (
            <PatientEmptyState
              title="Sin pedidos recientes"
              description="Cuando solicites una receta, vas a poder seguir el estado desde este panel."
              variant="requests"
            />
          )}
        </div>
      </section>
    </div>
  );
}
