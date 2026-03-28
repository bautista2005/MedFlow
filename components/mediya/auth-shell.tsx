import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  mode: "login" | "register";
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({
  mode,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl items-center justify-center px-6 py-10 md:px-10 lg:px-12">
      <div className="w-full max-w-[520px] rounded-[2rem] border border-white/85 bg-white/92 p-3 shadow-[0_32px_120px_rgba(37,99,235,0.14)] backdrop-blur">
        <div className="rounded-[1.7rem] border border-slate-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-6 py-6 md:px-8 md:py-8">
          <div className="rounded-full bg-slate-100 p-1">
            <div className="grid grid-cols-2 gap-1">
              <Link
                href="/login"
                className={[
                  "rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                  mode === "login"
                    ? "bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.26)]"
                    : "text-slate-500 hover:text-slate-900",
                ].join(" ")}
              >
                Log in
              </Link>
              <Link
                href="/registro-medico"
                className={[
                  "rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                  mode === "register"
                    ? "bg-[linear-gradient(135deg,_#2563eb,_#1d4ed8)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.26)]"
                    : "text-slate-500 hover:text-slate-900",
                ].join(" ")}
              >
                Register
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-balance text-4xl font-semibold leading-none tracking-[-0.05em] text-slate-900 md:text-[3.15rem]">
              {title}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-500">{description}</p>
            {mode === "register" ? (
              <p className="mt-4 rounded-[1rem] border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900/80">
                El registro esta habilitado solo para medicos. Si sos paciente, tu medico tiene que
                darte de alta en el sistema.
              </p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
