Quiero implementar en MedFlow el módulo web de calendario semanal del paciente.

Contexto funcional:
- El paciente ya tiene una pantalla principal con sus tratamientos activos.
- Debajo de “Mis tratamientos”, quiero agregar un módulo opcional de “Calendario semanal”.
- Este calendario se basa en los tratamientos que tengan weekly_schedule_configs activas.
- La idea del producto es una vista semanal de 7 días, donde dentro de cada día aparezcan los medicamentos que el paciente debe tomar.
- El paciente no crea esto: lo configura el médico desde su cuenta.
- El calendario debe reutilizar la información del tratamiento/prescripción ya cargado.

Objetivo:
Construir la UI web del calendario semanal del paciente y la capa de datos necesaria para mostrarla.

Requisitos:
1. Mostrar una vista semanal de 7 días.
2. Dentro de cada día, listar las tomas programadas de cada medicamento.
3. Cada item debe mostrar:
   - nombre del medicamento
   - dosis/unidad
   - horario o franja si existe
   - estado visual
4. Estados visuales:
   - gris = pendiente o sin registrar
   - verde = tomado correctamente
   - naranja = tomado fuera de horario
   - rojo = no tomado
5. Si no existen tratamientos con calendario semanal activo:
   - no renderizar el módulo o mostrar estado vacío elegante
6. La interfaz debe ser responsive:
   - desktop: grilla semanal clara
   - mobile: cards apiladas por día
7. Reutilizar los datos de prescriptions para nombre, dosis y demás datos clínicos.
8. La fuente del calendario deben ser:
   - prescriptions activas
   - weekly_schedule_configs activas
   - weekly_schedule_logs si existen
9. Implementar un selector de semana actual / siguiente / anterior si es razonable para el MVP.
10. No tocar todavía notificaciones ni anomalías.

Implementación esperada:
- función server-side o query para construir el calendario semanal
- mapper que expanda cada configuración semanal en una estructura de 7 días
- componente UI principal del calendario
- componentes por día y por toma
- estados vacíos y loading
- código limpio y comentado

Importante:
- No inventes datos mock si ya existe acceso a base real.
- Priorizá una implementación clara de MVP.
- La vista debe quedar lista para luego permitir acciones del paciente sobre cada toma.