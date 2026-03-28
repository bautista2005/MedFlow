# MEDIYA — Plan de implementación: sección de tratamiento médico

## 1. Objetivo

Implementar el alta de tratamientos desde el panel médico sin romper la lógica actual del proyecto, reutilizando la arquitectura existente de Next.js App Router, Supabase y los componentes UI ya definidos en el codebase.

El objetivo funcional real para esta iteración es:

- mantener la lista de pacientes dentro del panel médico
- aprovechar la pantalla de detalle del paciente que ya existe
- permitir que el médico agregue un tratamiento nuevo desde ese detalle
- persistir ese tratamiento en base de datos vinculado al paciente y al médico autenticado
- mostrar el tratamiento creado inmediatamente dentro del detalle del paciente
- dejar la estructura lista para consumo futuro desde la interfaz del paciente y para el cálculo de duración/reposición

## 2. Estado actual del codebase

## 2.1 Stack y arquitectura vigente

- framework: `next@16.2.1` con App Router
- frontend: `react@19.2.4`
- estilos: Tailwind CSS v4 con tokens en `app/globals.css`
- backend web: Route Handlers en `app/api/**`
- base de datos y auth: Supabase con `@supabase/supabase-js`
- cliente browser: `lib/supabase/browser.ts`
- cliente server público: `lib/supabase/server.ts`
- cliente admin/service role: `lib/supabase/admin.ts`

## 2.2 Estructura actual relevante

- panel médico: `app/(doctor)/panel/**`
- vista de pacientes: `app/(doctor)/panel/pacientes/page.tsx`
- detalle de paciente: `app/(doctor)/panel/pacientes/[patientId]/page.tsx`
- lista y alta de pacientes: `components/mediya/doctor/patients-panel.tsx`
- detalle del paciente: `components/mediya/doctor/patient-detail-panel.tsx`
- servicios cliente del dominio médico: `services/doctor/doctor-service.ts`
- tipos del dominio médico: `lib/doctor/types.ts`
- auth del médico para APIs: `lib/auth/doctor-session.ts`

## 2.3 Estado funcional actual

Hoy ya existen varias piezas que el documento original de `features/SeccionTratamiento.md` planteaba como futuras:

- la lista de pacientes ya existe
- cada paciente ya tiene navegación a detalle mediante `/panel/pacientes/[patientId]`
- la pantalla de detalle del paciente ya existe
- el detalle ya muestra datos del paciente en modo read-only
- el detalle ya muestra tratamientos cargados
- la base ya tiene una tabla específica para medicación del paciente: `public.patient_medications`

Por lo tanto, esta iteración no debe crear una solución paralela ni una tabla nueva llamada `prescriptions` o `treatments` para resolver el alta médica base. El modelo actual del sistema ya separa:

- `patient_medications`: definición del tratamiento/medicación activa
- `prescription_requests`: pedido de reposición o receta generado luego
- `prescription_files`: archivo de receta adjunto a un pedido

## 3. Modelo de datos actual

## 3.1 Tablas y relaciones ya presentes

### `approved_doctors`

- padrón de médicos aprobados
- luego se reclama vía RPC para crear una cuenta activa

### `active_doctors`

- perfil operativo del médico autenticado
- relación 1 a 1 con `auth.users`
- relación 1 a 1 con `approved_doctors`

### `patients`

- perfil del paciente
- relación 1 a 1 con `auth.users`
- FK a `pharmacies` mediante `preferred_pharmacy_id`
- FK a `active_doctors` mediante `created_by_active_doctor_id`

### `patient_doctors`

- tabla pivote entre paciente y médico
- permite que un paciente esté vinculado a uno o más médicos
- `is_primary` marca la relación principal

### `pharmacies`

- catálogo de farmacias

### `patient_medications`

- tabla correcta para esta funcionalidad
- hoy contiene:
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `medication_name`
  - `presentation`
  - `dose_text`
  - `frequency_text`
  - `pills_per_box`
  - `units_per_intake`
  - `intakes_per_day`
  - `notes`
  - `is_active`
  - timestamps

### `prescription_requests`

- pedido de receta vinculado a una medicación
- usa snapshots del medicamento al momento del pedido

### `prescription_files`

- archivo subido por el médico para un pedido de receta

## 3.2 Conclusión de schema

La funcionalidad de “agregar tratamiento desde médico” debe montarse sobre `patient_medications`, no sobre una tabla nueva. Solo conviene extender esa tabla si faltan datos clínicos/operativos necesarios para la lógica futura.

## 4. Gap entre el feature pedido y el sistema actual

## 4.1 Ya resuelto en el codebase

- lista de pacientes dentro del panel
- navegación al detalle del paciente
- visualización read-only del paciente
- visualización de tratamientos existentes

## 4.2 Pendiente real

- falta una acción explícita “Agregar tratamiento” en el detalle
- falta formulario para alta de tratamiento desde el detalle
- falta endpoint dedicado para crear un tratamiento de un paciente existente
- faltan tipos cliente/server para esa operación
- faltan algunos campos persistidos respecto de la especificación funcional, especialmente `start_date`

## 4.3 Desalineaciones del documento original

El archivo original propone una estructura mínima basada en:

- `prescriptions`
- `dose`
- `unit`
- `frequency`
- `quantity_per_box`
- `start_date`

Pero el codebase actual ya normaliza parcialmente estos datos de otra manera:

- `dose_text` y `frequency_text` ya existen y se usan en UI
- `pills_per_box`, `units_per_intake` e `intakes_per_day` ya fueron creados para soportar cálculos futuros
- `notes` ya existe
- no existe aún `start_date`
- no existe aún `next_consultation_date`

La implementación debe preservar este modelo actual y extenderlo, no reemplazarlo.

## 5. Decisión de implementación

## 5.1 Persistencia

Usar `public.patient_medications` como tabla principal del tratamiento.

## 5.2 Estrategia de compatibilidad

Mantener compatibilidad con el rendering actual del detalle del paciente y con la lógica de futuros pedidos de receta.

## 5.3 Flujo propuesto

1. El médico entra a `/panel/pacientes/[patientId]`.
2. En la sección de tratamientos ve la lista actual y un CTA `Agregar tratamiento`.
3. El CTA abre un formulario inline o modal dentro del panel actual.
4. El formulario envía un `POST` a un endpoint anidado del paciente.
5. El backend valida:
   - que la sesión pertenezca a un médico
   - que el paciente esté vinculado a ese médico
   - que los campos requeridos sean válidos
6. Se inserta el tratamiento en `patient_medications`.
7. Se refresca el detalle y el nuevo tratamiento aparece en la lista.

## 6. Cambios de base de datos

## 6.1 Recomendación

No crear una tabla nueva para esta iteración.

## 6.2 Cambio recomendado sobre `patient_medications`

Agregar los campos faltantes para cerrar la especificación funcional y soportar cálculos posteriores:

- `start_date date not null`
- `next_consultation_at timestamptz null`

Opcional según decisión de producto:

- `treatment_status text not null default 'active'`

Observación: hoy `is_active` ya cubre el estado básico mínimo. Si no hay un requerimiento claro de más estados, conviene no introducir `treatment_status` en esta iteración.

## 6.3 Campos existentes que ya cubren parte del requerimiento

- “medicamento” -> `medication_name`
- “cantidad por caja” -> `pills_per_box`
- “observaciones” -> `notes`
- “dosis” para visualización -> `dose_text`
- “frecuencia” para visualización -> `frequency_text`
- “convertible a dosis diaria” -> `units_per_intake` + `intakes_per_day`

## 6.4 Campos que no conviene duplicar

No conviene guardar simultáneamente:

- `dose` + `unit` + `frequency`
- y además otro conjunto equivalente sin una razón clara

La estrategia correcta es:

- persistir los valores estructurados necesarios para cálculos: `units_per_intake`, `intakes_per_day`, `pills_per_box`, `start_date`
- persistir los valores legibles para UI: `dose_text`, `frequency_text`, `presentation`

## 6.5 Regla operativa para cambios DDL

Cualquier creación o modificación de tablas, columnas, constraints, índices o políticas en Supabase debe ejecutarse usando el MCP server de Supabase instalado, no mediante cambios manuales fuera de ese flujo.

Además, como este repo toma `supabase/migrations/` como fuente de verdad del schema, el cambio debe quedar reflejado en una nueva migration versionada en ese directorio.

## 7. API y backend

## 7.1 Endpoint nuevo recomendado

Crear un endpoint:

- `app/api/doctor/patients/[patientId]/medications/route.ts`

con al menos:

- `POST` para crear tratamiento

No mezclar esta creación con `app/api/doctor/patients/route.ts`, porque ese endpoint hoy está orientado a:

- listar pacientes
- crear paciente completo

Separar la creación de tratamientos mantiene mejor cohesión.

## 7.2 Reutilización de autenticación existente

Reutilizar `requireAuthenticatedDoctor` de `lib/auth/doctor-session.ts`.

## 7.3 Validaciones backend mínimas

- `patientId` entero válido
- el paciente debe pertenecer al médico autenticado vía `patient_doctors`
- `medication_name` no vacío
- `dose_text` no vacío
- `frequency_text` no vacío
- `start_date` obligatorio
- `pills_per_box` mayor a 0 cuando se envía
- `units_per_intake` mayor a 0
- `intakes_per_day` mayor a 0
- `next_consultation_at` válido cuando se envía

## 7.4 Payload recomendado

Crear un tipo nuevo, por ejemplo:

```ts
export type CreatePatientTreatmentPayload = {
  medication_name: string;
  presentation?: string;
  dose_text: string;
  frequency_text: string;
  pills_per_box?: number | null;
  units_per_intake: number;
  intakes_per_day: number;
  start_date: string;
  next_consultation_at?: string | null;
  notes?: string;
};
```

## 7.5 Inserción recomendada

Insertar en `patient_medications`:

- `patient_id`
- `active_doctor_id`
- `medication_name`
- `presentation`
- `dose_text`
- `frequency_text`
- `pills_per_box`
- `units_per_intake`
- `intakes_per_day`
- `start_date`
- `next_consultation_at`
- `notes`
- `is_active = true`

## 7.6 Respuesta del endpoint

Responder con:

- mensaje de éxito
- `patient_medication_id`

Opcional:

- tratamiento creado completo para evitar otro fetch si se prefiere actualización optimista

## 8. Tipos y contratos a actualizar

## 8.1 `lib/doctor/types.ts`

Actualizar `PatientMedicationSummary` para reflejar el schema real post-migración:

- agregar `pills_per_box`
- agregar `units_per_intake`
- agregar `intakes_per_day`
- agregar `start_date`
- agregar `next_consultation_at`

Agregar además:

- `CreatePatientTreatmentPayload`

## 8.2 `services/doctor/doctor-service.ts`

Agregar una función como:

```ts
export function createDoctorPatientTreatment(
  patientId: string,
  payload: CreatePatientTreatmentPayload,
) {
  return doctorFetch(`/api/doctor/patients/${patientId}/medications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
```

## 9. UI y experiencia de usuario

## 9.1 No romper la estructura visual actual

Reutilizar:

- `Card`
- `Badge`
- `Button`
- `Input`
- `Label`
- tokens de `app/globals.css`

No introducir un sistema visual nuevo ni estilos fuera del lenguaje actual del panel médico.

## 9.2 Ubicación del formulario

La mejor opción para este codebase actual es abrir el formulario dentro de `components/mediya/doctor/patient-detail-panel.tsx` como bloque inline expandible o card secundaria.

Razones:

- minimiza rutas nuevas
- evita duplicar fetching
- aprovecha el estado ya cargado del detalle
- reduce complejidad para una iteración inicial

Solo tendría sentido crear una ruta nueva tipo `/panel/pacientes/[patientId]/tratamientos/nuevo` si el formulario creciera mucho o requiriera un flujo más complejo.

## 9.3 Campos del formulario

Campos mínimos recomendados:

- medicamento
- presentación
- dosis legible
- frecuencia legible
- unidades por toma
- tomas por día
- cantidad por caja
- fecha de inicio
- observaciones
- próxima consulta

## 9.4 Traducción entre UI y persistencia

Ejemplo de mapeo:

- UI “Dosis”: `1 comprimido`
- persistencia:
  - `dose_text = "1 comprimido"`
  - `units_per_intake = 1`

- UI “Frecuencia”: `2 veces por día`
- persistencia:
  - `frequency_text = "2 veces por día"`
  - `intakes_per_day = 2`

Esto conserva una representación humana para la UI y otra estructurada para cálculos.

## 9.5 Refresco de pantalla tras guardar

Después del alta:

- limpiar formulario
- mostrar mensaje de éxito
- refrescar el detalle del paciente

En este componente ya existe una carga inicial basada en `getDoctorPatientDetail(patientId)`. Conviene encapsular ese fetch en una función `loadPatient()` reutilizable para recargar luego del alta.

## 10. Ajustes de lectura del detalle

## 10.1 Endpoint actual

`app/api/doctor/patients/[patientId]/route.ts` ya devuelve medicaciones y pedidos.

## 10.2 Mejora necesaria

Actualizar el `select` de `patient_medications` para incluir las nuevas columnas que se agreguen en la migración, por ejemplo:

- `pills_per_box`
- `units_per_intake`
- `intakes_per_day`
- `start_date`
- `next_consultation_at`

## 10.3 Render recomendado

La card de medicación debería seguir siendo sintética, pero mostrar un poco más de contexto:

- nombre del medicamento
- dosis y frecuencia legible
- cantidad por caja si existe
- fecha de inicio
- próxima consulta si existe
- observaciones si existen

No hace falta mostrar todavía el cálculo visible de duración en UI.

## 11. Compatibilidad con la lógica futura

La implementación debe dejar preparado el terreno para:

- cálculo de duración estimada
- cálculo de fecha estimada de fin de caja
- generación de recordatorios
- futura interfaz del paciente
- futura lógica de “pedir más”

Fórmula prevista a soportar más adelante:

```txt
dosis_diaria = units_per_intake * intakes_per_day
dias_de_duracion = pills_per_box / dosis_diaria
fecha_fin_estimado = start_date + dias_de_duracion
```

No es necesario materializar estos cálculos en esta iteración, pero sí guardar los datos que los hacen posibles.

## 12. Archivos a tocar en implementación

## 12.1 Base de datos

- nueva migration en `supabase/migrations/`

## 12.2 Backend

- `app/api/doctor/patients/[patientId]/route.ts`
- `app/api/doctor/patients/[patientId]/medications/route.ts` nuevo
- `lib/doctor/types.ts`

## 12.3 Frontend

- `services/doctor/doctor-service.ts`
- `components/mediya/doctor/patient-detail-panel.tsx`

## 12.4 Opcional si se refactoriza

- `components/mediya/doctor/` crear subcomponente nuevo para formulario, por ejemplo:
  - `patient-treatment-form.tsx`

Esto sería recomendable para no sobrecargar `patient-detail-panel.tsx`.

## 13. Orden sugerido de implementación

1. Crear migration para extender `patient_medications` con los campos faltantes.
2. Actualizar tipos de dominio en `lib/doctor/types.ts`.
3. Extender `GET /api/doctor/patients/[patientId]` para leer los nuevos campos.
4. Crear `POST /api/doctor/patients/[patientId]/medications`.
5. Agregar función cliente en `services/doctor/doctor-service.ts`.
6. Incorporar formulario de alta en `patient-detail-panel.tsx` o en un subcomponente dedicado.
7. Refrescar el detalle tras guardar.
8. Validar manualmente el flujo completo con sesión médica.

## 14. Validaciones y pruebas

## 14.1 Casos felices

- médico autenticado crea tratamiento para paciente vinculado
- el tratamiento aparece en el detalle tras guardar
- los datos quedan persistidos correctamente en `patient_medications`

## 14.2 Casos de error

- `patientId` inválido
- médico intenta cargar tratamiento a un paciente no vinculado
- faltan campos requeridos
- `start_date` ausente
- `units_per_intake` o `intakes_per_day` inválidos
- `pills_per_box` inválido

## 14.3 Verificaciones de regresión

- no romper el alta actual de pacientes
- no romper el detalle actual del paciente
- no romper la lectura de pedidos de receta
- no alterar el flujo actual de upload de recetas

## 15. Alcance explícito de esta iteración

Sí incluye:

- crear tratamiento
- persistir tratamiento
- mostrarlo en el detalle del paciente
- preparar datos para cálculos futuros

No incluye:

- editar tratamiento
- eliminar tratamiento
- cálculo visible en pantalla
- integración automática con `prescription_requests`
- automatizaciones de recordatorio
- interfaz del paciente

## 16. Conclusión

La actualización correcta de este feature, dada la realidad del codebase, no es “agregar una tabla nueva de prescriptions”, sino completar el flujo de creación sobre la infraestructura ya existente de `patient_medications`.

El detalle del paciente y la navegación ya están implementados. Lo pendiente es cerrar el alta médica del tratamiento con:

- una pequeña extensión del schema actual
- un endpoint dedicado
- tipos y servicio cliente nuevos
- un formulario en la vista de detalle

Todo cambio de schema debe ejecutarse mediante el MCP server de Supabase instalado y quedar reflejado en `supabase/migrations/` para mantener la coherencia del proyecto.
