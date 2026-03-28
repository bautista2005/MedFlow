"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Menu } from "lucide-react";

type AppUserMenuProps = {
  roleLabel: string;
  greeting: string;
  name: string;
  initial: string;
  onLogout: () => Promise<void>;
};

export function AppUserMenu({
  roleLabel,
  greeting,
  name,
  initial,
  onLogout,
}: AppUserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setIsPending(true);

    try {
      await onLogout();
    } finally {
      setIsPending(false);
      setMenuOpen(false);
    }
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-3">
      <div className="hidden rounded-[16px] border border-slate-200 bg-white/90 px-4 py-2 text-right shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {roleLabel}
        </p>
        <p className="text-sm font-semibold text-slate-900">{greeting}</p>
        <p className="text-xs text-slate-500">{name}</p>
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#60A5FA,_#2563EB)] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]">
        {initial}
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-14 z-30 min-w-[220px] rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="rounded-[0.85rem] bg-slate-50 px-3 py-3 sm:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {roleLabel}
            </p>
            <p className="text-sm font-semibold text-slate-900">{greeting}</p>
            <p className="text-xs text-slate-500">{name}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="mt-2 flex w-full items-center gap-2 rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? "Saliendo..." : "Cerrar sesión"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
