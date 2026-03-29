"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bot, X } from "lucide-react";

import type { PatientChatLogSummary } from "@/lib/patient/types";
import { getPatientChatHistory, sendPatientChatMessage } from "@/services/patient/patient-service";
import { PatientChatbotInput } from "@/components/mediya/patient/patient-chatbot-input";
import { PatientChatbotMessageList } from "@/components/mediya/patient/patient-chatbot-message-list";
import { Button } from "@/components/ui/button";

type PatientChatbotModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function PatientChatbotModal({
  isOpen,
  onClose,
}: PatientChatbotModalProps) {
  const [messages, setMessages] = useState<PatientChatLogSummary[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setPendingUserMessage(null);
      setErrorMessage(null);
      setDisclaimer(null);
      return;
    }

    let cancelled = false;
    setErrorMessage(null);

    void getPatientChatHistory(20)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setMessages(result.messages);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el historial del asistente.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  async function handleSubmit(message: string) {
    setPendingUserMessage(message);
    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = await sendPatientChatMessage({ message });
      setMessages((current) => [result.message, ...current].slice(0, 20));
      setDisclaimer(result.disclaimer);
      setPendingUserMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo enviar el mensaje al asistente.",
      );
    } finally {
      setIsSending(false);
      setPendingUserMessage(null);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/30 p-3 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div className="flex h-[min(34rem,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-full max-w-[24rem] flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,_rgba(248,251,255,0.98),_rgba(255,255,255,0.98))] p-3 shadow-[0_34px_90px_rgba(15,23,42,0.22)] sm:h-[min(38rem,calc(100dvh-2.5rem))] sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-[25rem] sm:p-3.5">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="space-y-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-emerald-100 bg-emerald-50 text-emerald-700">
              <Bot className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Asistente MedFlow
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Consultas del paciente
              </h2>
              <p className="mt-1 max-w-[18rem] text-[13px] leading-5 text-slate-600">
                Evalua tu mensaje actual y lo deriva al medico si detecta seguimiento o urgencia.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 bg-white/90 p-0 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Cerrar asistente"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMessage ? (
          <div className="mt-3 rounded-[16px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {disclaimer ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{disclaimer}</p>
          </div>
        ) : null}

        <div className="mt-3 min-h-0 flex-1 overflow-hidden">
          <PatientChatbotMessageList
            messages={messages}
            pendingUserMessage={pendingUserMessage}
            isSending={isSending}
          />
        </div>

        <PatientChatbotInput disabled={isSending} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
