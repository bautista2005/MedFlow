"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

type PatientChatbotInputProps = {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
};

export function PatientChatbotInput({
  disabled = false,
  onSubmit,
}: PatientChatbotInputProps) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedMessage = message.trim();

    if (!normalizedMessage || disabled) {
      return;
    }

    setMessage("");
    await onSubmit(normalizedMessage);
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200/80 pt-3">
      <div className="flex items-center gap-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escribe tu consulta..."
          rows={1}
          maxLength={1000}
          disabled={disabled}
          className="h-12 max-h-12 flex-1 resize-none overflow-y-auto rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-[13px] text-sm leading-5 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <Button type="submit" className="h-12 rounded-[16px] px-5" disabled={disabled || !message.trim()}>
          <SendHorizontal className="mr-2 h-4 w-4" />
          Enviar
        </Button>
      </div>
      <p className="mt-2 px-1 text-[11px] leading-4 text-slate-500">
        El asistente orienta y registra contexto, pero no reemplaza una consulta medica.
      </p>
    </form>
  );
}
