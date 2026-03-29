"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getPatientNotificationBadgeSummary } from "@/services/patient/patient-service";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/paciente", label: "Inicio" },
  { href: "/paciente/notificaciones", label: "Notificaciones" },
];

export function PatientTopbarNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getPatientNotificationBadgeSummary()
      .then((result) => setUnreadCount(result.unread_count))
      .catch(() => setUnreadCount(0));
  }, [pathname]);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
                : "border-slate-200 bg-white/90 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-900",
            )}
          >
            <span>{item.label}</span>
            {item.href === "/paciente/notificaciones" && unreadCount > 0 ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
