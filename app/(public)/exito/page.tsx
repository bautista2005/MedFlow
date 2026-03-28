import Link from "next/link";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SuccessPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-4xl items-center justify-center px-6 py-10 md:px-10">
      <Card className="w-full max-w-2xl border-emerald-400/45 bg-[linear-gradient(135deg,_rgba(28,170,103,0.98),_rgba(9,108,73,0.98))] text-white shadow-[0_40px_120px_rgba(14,98,70,0.35)]">
        <CardHeader className="items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/16">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <div className="space-y-3">
            <CardTitle className="text-4xl md:text-5xl">
              Inicio de sesión exitoso
            </CardTitle>
            <CardDescription className="max-w-xl text-base leading-7 text-white/84 md:text-lg">
              La autenticación funcionó correctamente
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild variant="secondary" size="lg">
            <Link href="/">Volver al inicio</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="border-white/20 text-white hover:bg-white/12 hover:text-white"
          >
            <Link href="/login">Probar login otra vez</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
