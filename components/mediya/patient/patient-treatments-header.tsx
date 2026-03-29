export function PatientTreatmentsHeader() {
  return (
    <section className="px-5 py-5 md:px-6 md:py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
        Mis tratamientos
      </p>
      <h2 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-slate-900">
        Seguimiento activo
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Visualizá la medicación cargada por tu médico y el estado de reposición de cada
        tratamiento.
      </p>
    </section>
  );
}
