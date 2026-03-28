import { RegisterDoctorForm } from "@/components/mediya/forms/register-doctor-form";
import { AuthShell } from "@/components/mediya/auth-shell";

export default function RegisterDoctorPage() {
  return (
    <AuthShell
      mode="register"
      title="Registro profesional"
      description="La cuenta profesional se crea a partir de un DNI previamente aprobado en MedFlow."
    >
      <RegisterDoctorForm />
    </AuthShell>
  );
}
