"use client";

import { useEffect, useEffectEvent, useState } from "react";

import type { DoctorRequestsResponse } from "@/lib/doctor/types";
import {
  listDoctorRequests,
  updateDoctorRequestPharmacyStatus,
  updateDoctorRequestNote,
  uploadDoctorPrescriptionFile,
} from "@/services/doctor/doctor-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function requiresDoctorAction(status: DoctorRequestsResponse["requests"][number]["status"]) {
  return status === "pending" || status === "reviewed";
}

export function RequestsPanel() {
  const [data, setData] = useState<DoctorRequestsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [autoConfirmingRequestId, setAutoConfirmingRequestId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [updatingPharmacyRequestId, setUpdatingPharmacyRequestId] = useState<number | null>(null);

  async function refresh() {
    const result = await listDoctorRequests();
    setData(result);
    setNoteDrafts((currentDrafts) => {
      const nextDrafts: Record<number, string> = {};

      for (const request of result.requests) {
        nextDrafts[request.prescription_request_id] =
          currentDrafts[request.prescription_request_id] ?? request.doctor_note ?? "";
      }

      return nextDrafts;
    });
  }

  const refreshWithFeedback = useEffectEvent(async () => {
    try {
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar pedidos.",
      );
    }
  });

  useEffect(() => {
    void refreshWithFeedback();

    const intervalId = window.setInterval(() => {
      void refreshWithFeedback();
    }, 15000);

    const handleWindowFocus = () => {
      void refreshWithFeedback();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshWithFeedback();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function handleUpload(requestId: number, fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    setUploadingId(requestId);
    setErrorMessage(null);

    try {
      await uploadDoctorPrescriptionFile(requestId, file);
      await refresh();
      setAutoConfirmingRequestId(requestId);

      window.setTimeout(() => {
        setUpdatingPharmacyRequestId(requestId);
        setErrorMessage(null);

        void updateDoctorRequestPharmacyStatus(requestId, { status: "ready_for_pickup" })
          .then(() => refresh())
          .catch((error) => {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "No se pudo confirmar automaticamente el retiro.",
            );
          })
          .finally(() => {
            setUpdatingPharmacyRequestId((currentId) =>
              currentId === requestId ? null : currentId,
            );
            setAutoConfirmingRequestId((currentId) =>
              currentId === requestId ? null : currentId,
            );
          });
      }, 5000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir la receta.",
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSaveNote(requestId: number) {
    const note = noteDrafts[requestId]?.trim() ?? "";

    if (!note) {
      setErrorMessage("Ingresa una observacion antes de guardarla.");
      return;
    }

    setSavingNoteId(requestId);
    setErrorMessage(null);

    try {
      await updateDoctorRequestNote(requestId, { doctor_note: note });
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo guardar la observacion.",
      );
    } finally {
      setSavingNoteId(null);
    }
  }

  async function handleUpdatePharmacyStatus(
    requestId: number,
    status: "pharmacy_checking" | "awaiting_alternative_pharmacy" | "ready_for_pickup",
  ) {
    setUpdatingPharmacyRequestId(requestId);
    setErrorMessage(null);

    try {
      await updateDoctorRequestPharmacyStatus(requestId, { status });
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado de farmacia.",
      );
    } finally {
      setUpdatingPharmacyRequestId(null);
    }
  }

  const statusLabelMap: Record<DoctorRequestsResponse["requests"][number]["status"], string> = {
    pending: "Pendiente",
    reviewed: "En revisión",
    prescription_uploaded: "Receta cargada",
    pharmacy_checking: "Consultando farmacia",
    no_stock_preferred: "Sin stock",
    awaiting_alternative_pharmacy: "Esperando farmacia alternativa",
    ready_for_pickup: "Listo para retirar",
    cancelled: "Cancelado",
  };
  const visibleRequests = (data?.requests ?? []).filter((request) =>
    requiresDoctorAction(request.status),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-blue-100 bg-[linear-gradient(135deg,_rgba(37,99,235,0.10),_rgba(59,130,246,0.04)_55%,_rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_22px_50px_rgba(37,99,235,0.10)] md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Solicitudes
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
          Pedidos de receta
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Revisá nuevas solicitudes y cargá archivos asociados sin salir del flujo clínico.
        </p>
      </div>

      <Card className="border-blue-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <Badge>Pedidos</Badge>
          <CardTitle>Gestión de recetas</CardTitle>
          <CardDescription>
            Cada carga queda vinculada al pedido y al medico autenticado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {visibleRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay pedidos registrados todavia.
            </p>
          ) : null}
          {visibleRequests.map((request) => (
            <div
              key={request.prescription_request_id}
              className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-blue-200 hover:bg-blue-50/35 hover:shadow-[0_18px_34px_rgba(37,99,235,0.10)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {request.patient_name}
                    </h3>
                    <Badge className="border-blue-200 bg-white text-blue-700">
                      {statusLabelMap[request.status]}
                    </Badge>
                  </div>
                  <p>{request.medication_name}</p>
                  <p>Pedido: {new Date(request.requested_at).toLocaleString("es-AR")}</p>
                  {request.resolved_at ? (
                    <p>
                      Ultima actualizacion:{" "}
                      {new Date(request.resolved_at).toLocaleString("es-AR")}
                    </p>
                  ) : null}
                  <p>
                    {request.assigned_pharmacy
                      ? `Farmacia actual: ${request.assigned_pharmacy.name}`
                      : "Sin farmacia asignada"}
                  </p>
                  {request.patient_note ? <p>Observacion del paciente: {request.patient_note}</p> : null}
                  {request.doctor_note ? <p>Observacion medica: {request.doctor_note}</p> : null}
                  <p>
                    {request.current_file
                      ? `Receta actual: ${request.current_file.original_filename}`
                      : "Sin receta subida"}
                  </p>
                </div>
                <div className="space-y-2">
                  {request.status === "pending" || request.status === "reviewed" ? (
                    <>
                      <textarea
                        value={noteDrafts[request.prescription_request_id] ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [request.prescription_request_id]: event.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={600}
                        placeholder="Agregar observacion para el paciente"
                        className="w-full min-w-[240px] rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none transition focus:border-blue-200 focus:bg-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveNote(request.prescription_request_id)}
                        disabled={savingNoteId === request.prescription_request_id}
                      >
                        {savingNoteId === request.prescription_request_id
                          ? "Guardando..."
                          : "Guardar observacion"}
                      </Button>
                      <input
                        id={`file-${request.prescription_request_id}`}
                        type="file"
                        accept="image/png,application/pdf"
                        className="max-w-[220px] rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
                        onChange={(event) =>
                          handleUpload(request.prescription_request_id, event.target.files)
                        }
                      />
                      <p className="text-xs text-slate-500">
                        {uploadingId === request.prescription_request_id
                          ? "Subiendo..."
                          : autoConfirmingRequestId === request.prescription_request_id
                            ? "Receta subida. Se confirmara retiro automaticamente en 5 segundos."
                          : "La carga se procesa apenas seleccionas el archivo."}
                      </p>
                    </>
                  ) : request.status === "prescription_uploaded" ||
                    request.status === "pharmacy_checking" ||
                    request.status === "no_stock_preferred" ||
                    request.status === "awaiting_alternative_pharmacy" ? (
                    <div className="flex flex-col gap-2">
                      {(request.status === "prescription_uploaded" ||
                        request.status === "pharmacy_checking") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleUpdatePharmacyStatus(
                              request.prescription_request_id,
                              "awaiting_alternative_pharmacy",
                            )
                          }
                          disabled={updatingPharmacyRequestId === request.prescription_request_id}
                        >
                          {updatingPharmacyRequestId === request.prescription_request_id
                            ? "Actualizando..."
                            : "Informar falta de stock"}
                        </Button>
                      )}
                      {(request.status === "prescription_uploaded" ||
                        request.status === "pharmacy_checking") && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            handleUpdatePharmacyStatus(
                              request.prescription_request_id,
                              "ready_for_pickup",
                            )
                          }
                          disabled={updatingPharmacyRequestId === request.prescription_request_id}
                        >
                          {updatingPharmacyRequestId === request.prescription_request_id
                            ? "Actualizando..."
                            : "Marcar listo para retirar"}
                        </Button>
                      )}
                      {request.status === "awaiting_alternative_pharmacy" ? (
                        <p className="text-xs text-slate-500">
                          Esperando que el paciente elija otra farmacia.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1 text-xs text-slate-500">
                      <p>
                        {request.status === "ready_for_pickup"
                          ? "El pedido ya figura como listo para retirar."
                          : "Este pedido ya llego a una etapa final."}
                      </p>
                      {request.resolved_at ? (
                        <p>
                          Confirmado el{" "}
                          {new Date(request.resolved_at).toLocaleString("es-AR")}.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
