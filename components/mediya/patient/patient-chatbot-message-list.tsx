"use client";

import { useEffect, useRef } from "react";

import type { PatientChatLogSummary, PatientChatSeverity } from "@/lib/patient/types";
import { cn } from "@/lib/utils";

type PatientChatbotMessageListProps = {
  messages: PatientChatLogSummary[];
  pendingUserMessage: string | null;
  isSending: boolean;
};

const severityLabels: Record<PatientChatSeverity, string> = {
  normal: "Normal",
  warning: "Seguimiento",
  critical: "Atencion",
};

const severityClassNames: Record<PatientChatSeverity, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PatientChatbotMessageList({
  messages,
  pendingUserMessage,
  isSending,
}: PatientChatbotMessageListProps) {
  const orderedMessages = [...messages].reverse();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pendingUserMessage, isSending]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-1 pr-2">
      {orderedMessages.length === 0 ? (
        <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
          Hola, soy tu asistente de MedFlow. Puedo orientarte segun tus tratamientos, pedidos y
          registros recientes. Contame que necesitas.
        </div>
      ) : null}

      {orderedMessages.map((message) => (
        <div key={message.patient_chat_log_id} className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[86%] rounded-[20px] rounded-br-sm bg-slate-900 px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
              <p>{message.message_user}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                Vos · {formatTimestamp(message.created_at)}
              </p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-[20px] rounded-bl-sm border border-white/70 bg-white/92 px-4 py-3 text-sm text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  MedFlow
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                    severityClassNames[message.severity],
                  )}
                >
                  {severityLabels[message.severity]}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap leading-6">{message.message_ai}</p>
            </div>
          </div>
        </div>
      ))}

      {pendingUserMessage ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[86%] rounded-[20px] rounded-br-sm bg-slate-900 px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
              <p>{pendingUserMessage}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/55">Vos</p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-[20px] rounded-bl-sm border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
              {isSending ? "Procesando..." : "Esperando respuesta..."}
            </div>
          </div>
        </div>
      ) : null}

      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
