"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

import { PatientChatbotModal } from "@/components/mediya/patient/patient-chatbot-modal";
import { Button } from "@/components/ui/button";

export function PatientChatbotLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 sm:bottom-6 sm:px-6 md:px-10 lg:px-12">
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto h-14 rounded-full border border-emerald-300/60 bg-[linear-gradient(135deg,_#059669,_#0284c7)] px-5 text-white shadow-[0_18px_45px_rgba(5,150,105,0.28)]"
        >
          <Bot className="mr-2 h-5 w-5" />
          Abrir asistente
        </Button>
      </div>

      <PatientChatbotModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
