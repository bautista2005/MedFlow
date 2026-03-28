"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
    const supabase = createBrowserSupabaseClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
    >
      {isPending ? "Saliendo..." : "Cerrar sesion"}
    </Button>
  );
}
