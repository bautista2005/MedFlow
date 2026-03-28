import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  href?: string;
};

export function Logo({ compact = false, href = "/" }: LogoProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#38bdf8,_#2563eb)] text-lg font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)]">
        M
      </span>
      <span className={cn("flex flex-col", compact && "hidden sm:flex")}>
        <span className="font-serif text-2xl leading-none tracking-[-0.06em] text-blue-900">
          MedFlow
        </span>
        <span className="text-xs uppercase tracking-[0.22em] text-blue-900/45">
          Flujo clínico
        </span>
      </span>
    </Link>
  );
}
