import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";

import type { PrescriptionProgressSummary } from "@/lib/patient/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrescriptionProgressNotificationProps = {
  progress: PrescriptionProgressSummary;
  actionUrl?: string | null;
  createdAt: string;
  isUpdating: boolean;
  onDismiss?: () => void;
};

export function PrescriptionProgressNotification({
  progress,
  actionUrl = null,
  createdAt,
  isUpdating,
  onDismiss,
}: PrescriptionProgressNotificationProps) {
  const isCompleted = progress.currentStep >= progress.totalSteps;

  return (
    <article className="relative overflow-hidden rounded-[24px] border border-blue-200/80 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(219,234,254,0.96))] p-5 text-blue-950 shadow-[0_20px_45px_rgba(37,99,235,0.14)] md:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300" />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              {progress.title}
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                isCompleted
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white",
              )}
            >
              {progress.currentStepLabel}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
              {progress.medicationName}
            </h3>
            <p className="mt-1 text-sm font-medium text-blue-800">
              Paso {progress.currentStep} de {progress.totalSteps}
            </p>
            {progress.helperText ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                {progress.helperText}
              </p>
            ) : null}
          </div>
        </div>

        {progress.dismissible && onDismiss ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            disabled={isUpdating}
            className="h-10 w-10 rounded-full border border-blue-200/80 bg-white/70 text-blue-700 hover:bg-white"
            aria-label="Descartar notificación"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200/80 bg-white/70 text-blue-700">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-5 rounded-[18px] border border-blue-200/80 bg-white/55 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-slate-900">{progress.currentStepLabel}</p>
          <p className="font-medium text-blue-700">{progress.progressPercentage}% completado</p>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div
            className="relative px-2"
            style={{ minWidth: `${Math.max(progress.totalSteps * 6.75, 22)}rem` }}
          >
            <div className="absolute left-[1.15rem] right-[1.15rem] top-4 h-[3px] rounded-full bg-blue-200/90" />
            <div
              className="absolute left-[1.15rem] top-4 h-[3px] rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300"
              style={{
                width:
                  progress.totalSteps === 1
                    ? "calc(100% - 2.3rem)"
                    : `calc(((100% - 2.3rem) * ${(progress.currentStep - 1) / (progress.totalSteps - 1)}))`,
              }}
            />

            <div
              className="relative grid gap-3"
              style={{ gridTemplateColumns: `repeat(${progress.totalSteps}, minmax(0, 1fr))` }}
            >
              {progress.steps.map((step, index) => {
                const stepNumber = index + 1;
                const isPast = stepNumber < progress.currentStep;
                const isCurrent = stepNumber === progress.currentStep;

                return (
                  <div key={step} className="flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                        isPast
                          ? "border-blue-600 bg-blue-600 text-white"
                          : isCurrent
                            ? "border-cyan-400 bg-white text-blue-700 shadow-[0_0_0_6px_rgba(255,255,255,0.55)]"
                            : "border-blue-200 bg-white/90 text-slate-500",
                      )}
                    >
                      {isPast ? <Check className="h-4 w-4" /> : stepNumber}
                    </div>
                    <p
                      className={cn(
                        "mt-3 text-xs leading-5",
                        isPast || isCurrent ? "font-semibold text-slate-900" : "text-slate-500",
                      )}
                    >
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-blue-900/80 md:flex-row md:items-center md:justify-between">
        <p>Actualizado el {new Date(createdAt).toLocaleString("es-AR")}</p>
        {actionUrl ? (
          <Button asChild size="sm" variant="secondary" className="bg-white/80 text-blue-800 hover:bg-white">
            <Link href={actionUrl}>
              Ver detalle
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
