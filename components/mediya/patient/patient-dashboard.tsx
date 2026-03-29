"use client";

import { useEffect, useState } from "react";

import type { CreatePatientRequestPayload, PatientDashboardResponse } from "@/lib/patient/types";
import {
  createPatientRequest,
  getPatientDashboard,
  updatePatientAlternativePharmacy,
} from "@/services/patient/patient-service";
import { PatientEmptyState } from "@/components/mediya/patient/patient-empty-state";
import { PatientRequestTracker } from "@/components/mediya/patient/patient-request-tracker";
import { PatientTreatmentCard } from "@/components/mediya/patient/patient-treatment-card";
import { PatientTreatmentsHeader } from "@/components/mediya/patient/patient-treatments-header";
import { PatientWeeklyCalendar } from "@/components/mediya/patient/patient-weekly-calendar";

export function PatientDashboard() {
  const [data, setData] = useState<PatientDashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [updatingAlternativeRequestId, setUpdatingAlternativeRequestId] = useState<number | null>(
    null,
  );

  async function refresh() {
    const dashboardResult = await getPatientDashboard();
    setData(dashboardResult);
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

  async function handleChooseAlternativePharmacy(requestId: number, pharmacyId: number) {
    setUpdatingAlternativeRequestId(requestId);
    setErrorMessage(null);

    try {
      await updatePatientAlternativePharmacy(requestId, { pharmacy_id: pharmacyId });
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la farmacia del pedido.",
      );
    } finally {
      setUpdatingAlternativeRequestId(null);
    }
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[22px] border border-blue-100 bg-[linear-gradient(135deg,_rgba(37,99,235,0.10),_rgba(59,130,246,0.04)_55%,_rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_22px_50px_rgba(37,99,235,0.10)] md:px-7">
        <div>
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div>
          <div className="rounded-[24px] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <PatientTreatmentsHeader />

            <div className="grid gap-4 px-5 pb-5 md:px-6 md:pb-6">
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

        <div>
          <div className="space-y-6">
            {data?.requests.length ? (
              <PatientRequestTracker
                requests={data.requests}
                pharmacies={data.pharmacies}
                onChooseAlternativePharmacy={handleChooseAlternativePharmacy}
                submittingRequestId={updatingAlternativeRequestId}
              />
            ) : (
              <PatientEmptyState
                title="Sin pedidos recientes"
                description="Cuando solicites una receta, vas a poder seguir el estado desde este panel."
                variant="requests"
              />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl">
        <PatientWeeklyCalendar hasTreatments={Boolean(data?.medications.length)} />
      </section>
    </div>
  );
}
