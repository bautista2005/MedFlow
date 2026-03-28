import { PatientDetailPanel } from "@/components/mediya/doctor/patient-detail-panel";

type PatientDetailPageProps = {
  params: Promise<{
    patientId: string;
  }>;
};

export default async function DoctorPatientDetailPage({
  params,
}: PatientDetailPageProps) {
  const { patientId } = await params;

  return <PatientDetailPanel patientId={patientId} />;
}
