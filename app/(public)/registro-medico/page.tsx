import { Stethoscope } from "lucide-react";

import { RegisterDoctorForm } from "@/components/mediya/forms/register-doctor-form";

export default function RegisterDoctorPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center px-4 py-3 md:px-6 md:py-4">
      <div className="w-full max-w-[22.5rem] md:max-w-[23.5rem]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(180deg,_#2d72ff_0%,_#1f5ae8_100%)] text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)] md:h-11 md:w-11 md:rounded-[1rem]">
            <Stethoscope className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.2} />
          </div>
          <h1 className="mt-2 text-[1.7rem] font-extrabold tracking-[-0.08em] text-slate-950 md:mt-2.5 md:text-[2rem]">
            MEDFLOW
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500 md:mt-1 md:text-xs">
            Sistema de gestión de medicamentos
          </p>
        </div>

        <div className="mt-2.5 rounded-[1.2rem] border border-white/90 bg-white/92 p-1.5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] backdrop-blur md:mt-3 md:rounded-[1.35rem] md:p-1.5">
          <div className="rounded-[1rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,250,255,0.98)_100%)] px-3 py-3 md:rounded-[1.15rem] md:px-4 md:py-3.5">
            <div className="text-center">
              <h2 className="text-[1.2rem] font-bold tracking-[-0.06em] text-slate-950 md:text-[1.35rem]">
                Registro médico
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500 md:px-2 md:text-xs">
                Creá tu cuenta con un DNI previamente aprobado en MedFlow.
              </p>
            </div>

            <div className="mt-3">
              <RegisterDoctorForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
