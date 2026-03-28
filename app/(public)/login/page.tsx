import { LoginForm } from "@/components/mediya/forms/login-form";
import { AuthShell } from "@/components/mediya/auth-shell";

type LoginPageProps = {
  searchParams?: Promise<{
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const notice =
    params.registered === "1"
      ? "Registro completado. Ya podés iniciar sesión con tu email y contraseña."
      : null;

  return (
    <AuthShell
      mode="login"
      title="Ingresar a MedFlow"
      description="Accedé con tu email o DNI y tu contraseña."
    >
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
