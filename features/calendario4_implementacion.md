# Calendario semanal del paciente con adherencia: plan de implementación adaptado a MEDIYA

## Estado real actual del codebase

Después de revisar el repo, este feature no arranca desde cero:

- Ya existe lectura del calendario semanal en `app/api/patient/calendar/route.ts`.
- Ya existe el builder server-side en `lib/calendar/weekly-calendar.ts` que:
  - resuelve una semana
  - expande `weekly_schedule_configs`
  - cruza `weekly_schedule_logs`
  - devuelve estado `pending` cuando no existe log
- Ya existen tipos de calendario en `lib/calendar/types.ts`.
- Ya existe consumo cliente en `services/patient/patient-service.ts` con `getPatientWeeklyCalendar()`.
- Ya existe UI base en:
  - `components/mediya/patient/patient-weekly-calendar.tsx`
  - `components/mediya/patient/patient-weekly-calendar-day.tsx`
  - `components/mediya/patient/patient-weekly-calendar-dose.tsx`
- El dashboard del paciente ya renderiza el módulo desde `components/mediya/patient/patient-dashboard.tsx`.
- El alta del tratamiento semanal ya está conectada del lado médico:
  - `components/mediya/doctor/patient-treatment-form.tsx`
  - `app/api/doctor/patients/[patientId]/medications/route.ts`
  - RPC `public.create_patient_treatment_with_optional_schedule(...)`

Conclusión: la parte de lectura y render del calendario ya está bastante avanzada. El gap real de `Calendario4` es la escritura de adherencia por parte del paciente.

## Esquema real de Supabase relevante

### Tablas existentes

`public.patient_medications`

- Es la entidad clínica base del tratamiento.
- En este codebase cumple el rol que el brief llama “prescription”.
- PK: `patient_medication_id`.
- Relaciona paciente, médico y metadata clínica del tratamiento.

`public.weekly_schedule_configs`

- Ya existe.
- Una config semanal por tratamiento: `unique (patient_medication_id)`.
- Define:
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `is_enabled`
  - `schedule_start_date`
  - `schedule_end_date`
  - `days_of_week`
  - `intake_slots`
  - `notes`

`public.weekly_schedule_logs`

- Ya existe.
- Registra una toma concreta por fecha y slot.
- PK: `weekly_schedule_log_id`.
- Unicidad actual:
  - `unique (weekly_schedule_config_id, scheduled_for_date, slot_key)`
- Guarda hoy:
  - `weekly_schedule_config_id`
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `scheduled_for_date`
  - `slot_key`
  - `scheduled_time`
  - `status`
  - `recorded_by_role`
  - `recorded_by_auth_user_id`
  - `note`
  - `logged_at`

### Relaciones relevantes

- `patient_medications.patient_id -> patients.patient_id`
- `patient_medications.active_doctor_id -> active_doctors.active_doctor_id`
- `weekly_schedule_configs.patient_medication_id -> patient_medications.patient_medication_id`
- `weekly_schedule_logs.weekly_schedule_config_id -> weekly_schedule_configs.weekly_schedule_config_id`
- `weekly_schedule_logs.patient_medication_id -> patient_medications.patient_medication_id`
- `weekly_schedule_logs.patient_id -> patients.patient_id`

### Estado actual de datos

- `weekly_schedule_configs` existe pero hoy está vacía.
- `weekly_schedule_logs` existe pero hoy está vacía.
- Eso simplifica la migración porque no hay que backfillear datos históricos.

## Aclaración importante sobre el brief

El brief habla de `prescription_id`, pero este proyecto no tiene una tabla `prescriptions`.

La adaptación correcta al dominio actual es:

- `prescription_id` del brief => `patient_medication_id`
- “prescripción + configuración semanal” => `patient_medications` + `weekly_schedule_configs`

No conviene inventar una nueva tabla `prescriptions` ni cambiar la estructura central de tratamientos. Eso rompería el diseño actual y contradice la instrucción de no tocar la estructura central.

## Gap exacto contra Calendario4

Hoy ya existe:

- la expansión semanal
- el cruce con logs
- el estado visual base
- el endpoint de lectura

Hoy todavía no existe:

- endpoint o server action para crear/actualizar logs de adherencia
- validación explícita para que el paciente solo edite sus propias tomas
- interacción en la tarjeta de dosis
- persistencia de `taken_at`
- actualización optimista o refresco puntual de la UI

## Decisión de esquema

### Cambio recomendado

Sí recomiendo una migración puntual sobre `weekly_schedule_logs`.

### Motivo

El brief pide guardar `taken_at cuando corresponda`, y el schema actual no lo tiene.

`logged_at` no es equivalente:

- `logged_at` significa “cuándo se registró el cambio”
- `taken_at` significa “cuándo dice el paciente que tomó la medicación”

Si en el futuro quieren medir adherencia semanal, puntualidad o anomalías, separar ambos timestamps es correcto.

### Migración propuesta

Crear una nueva migración, por ejemplo:

- `supabase/migrations/20260328xxxxxx_weekly_schedule_logs_taken_at.sql`

Contenido esperado:

- agregar columna `taken_at timestamptz null`
- agregar constraint para consistencia mínima:
  - si `status = 'taken'` o `status = 'taken_late'`, `taken_at` puede existir
  - si `status = 'missed'`, `taken_at` debe ser `null`

Constraint sugerido:

```sql
alter table public.weekly_schedule_logs
add column taken_at timestamptz null;

alter table public.weekly_schedule_logs
add constraint weekly_schedule_logs_taken_at_consistency
check (
  (status = 'missed' and taken_at is null)
  or (status in ('taken', 'taken_late'))
);
```

Si quieren ser más flexibles para la demo, también es válido no forzar `taken_at is not null` a nivel DB y resolverlo en aplicación. Pero mi recomendación es:

- app: siempre setear `taken_at` para `taken` y `taken_late`
- DB: asegurar que `missed` no tenga `taken_at`

## Diseño de la solución

### 1. Mantener el endpoint de lectura existente

No hace falta reemplazar `GET /api/patient/calendar`.

Conviene mantener:

- `app/api/patient/calendar/route.ts`
- `lib/calendar/weekly-calendar.ts`

Y extenderlos para devolver `taken_at` dentro del log/dose summary.

### 2. Agregar endpoint de escritura específico del paciente

Crear:

- `app/api/patient/calendar/logs/route.ts`

Responsabilidad:

- recibir la acción del paciente
- validar sesión con `requireAuthenticatedPatient()`
- validar que la toma pertenece al paciente autenticado
- crear o actualizar el log
- devolver el estado final normalizado

Recomiendo `POST` con semántica de upsert de negocio.

Payload sugerido:

```ts
type UpsertPatientCalendarLogPayload = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  status: "taken" | "missed" | "taken_late";
};
```

No incluiría `patient_id` desde cliente.

Se resuelve del token autenticado.

### 3. Crear una capa de servicio cliente para la nueva escritura

Extender `services/patient/patient-service.ts` con algo como:

- `upsertPatientCalendarLog(payload)`

Esto mantiene el patrón actual:

- UI cliente
- `services/*`
- `app/api/*`

### 4. Crear lógica server-side modular para upsert

No meter toda la lógica en el route handler.

Crear un módulo nuevo, por ejemplo:

- `lib/calendar/logging.ts`

Responsabilidades:

- validar payload
- cargar config + tratamiento
- verificar pertenencia al paciente
- resolver `scheduled_time` a partir del `slot_key`
- armar el objeto de insert/update
- ejecutar upsert lógico
- devolver la dosis/log actualizado

## Validación de ownership

Esta parte es obligatoria.

La regla correcta es:

1. el paciente autenticado viene de `requireAuthenticatedPatient(request)`
2. buscar la config por `weekly_schedule_config_id`
3. unir con `patient_medications`
4. validar:
   - `weekly_schedule_configs.patient_id === patient.patientId`
   - `patient_medications.patient_id === patient.patientId`
   - `patient_medication_id` del payload coincide con la config
5. validar además que:
   - la fecha cae dentro del rango habilitado
   - el `slot_key` existe dentro de `intake_slots`
   - el día de la semana pertenece a `days_of_week`

Si falla cualquiera de esas validaciones:

- responder `403` si es un problema de ownership
- responder `400` si el payload es inválido
- responder `404` si la toma/config no existe

## Regla de persistencia

### Caso 1: no existe log

Insertar en `weekly_schedule_logs`:

- `weekly_schedule_config_id`
- `patient_medication_id`
- `patient_id`
- `active_doctor_id`
- `scheduled_for_date`
- `slot_key`
- `scheduled_time`
- `status`
- `recorded_by_role = 'patient'`
- `recorded_by_auth_user_id = auth user id`
- `logged_at = now()`
- `taken_at = now()` cuando `status` sea `taken` o `taken_late`

### Caso 2: ya existe log

Actualizar el registro existente con:

- `status`
- `scheduled_time`
- `recorded_by_role`
- `recorded_by_auth_user_id`
- `logged_at`
- `taken_at`

Regla de `taken_at`:

- `taken` => `now()`
- `taken_late` => `now()`
- `missed` => `null`

Para esta iteración hackathon, usar `now()` del servidor está bien. No hace falta pedir una hora custom al paciente.

## Estrategia de upsert

No confiar ciegamente en `upsert()` directo sin validar.

Secuencia recomendada:

1. cargar config y tratamiento
2. validar ownership y consistencia del slot/fecha
3. buscar log existente por:
   - `weekly_schedule_config_id`
   - `scheduled_for_date`
   - `slot_key`
4. si existe:
   - `update`
5. si no existe:
   - `insert`

Esto es más claro para este codebase y más fácil de depurar en demo.

## Cambios en tipos

### `lib/calendar/types.ts`

Agregar o extender:

- `WeeklyScheduleLogStatus` ya existe y sirve
- `WeeklyScheduleLogSummary` debe incluir `taken_at`
- `PatientWeeklyCalendarDose` debe incluir `taken_at`
- crear tipo para el payload de escritura, por ejemplo:
  - `PatientCalendarLogStatus`
  - `UpsertPatientCalendarLogPayload`
  - `UpsertPatientCalendarLogResponse`

Ejemplo:

```ts
export type PatientCalendarLogStatus = "taken" | "missed" | "taken_late";

export type UpsertPatientCalendarLogPayload = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  scheduled_for_date: string;
  slot_key: string;
  status: PatientCalendarLogStatus;
};
```

## Cambios en lectura del calendario

### `lib/calendar/weekly-calendar.ts`

Extender el `select` de logs para incluir `taken_at`.

Luego mapearlo a `PatientWeeklyCalendarDose`.

Esto deja al frontend listo para:

- reflejar el nuevo estado
- mostrar luego la hora real de toma si quieren
- calcular adherencia más adelante

No hace falta cambiar la lógica central de expansión semanal.

## Cambios de UI

### 1. Hacer interactiva la tarjeta de dosis

Archivo actual:

- `components/mediya/patient/patient-weekly-calendar-dose.tsx`

Hoy es solo visual. Debe pasar a soportar click.

### 2. Agregar una acción simple, no una UX compleja

Para hackathon/demo recomiendo:

- convertir cada tarjeta en botón o agregar botón “Marcar”
- abrir un pequeño popover, dropdown o panel inline con 3 acciones:
  - `Lo tomé`
  - `No lo tomé`
  - `Lo tomé fuera de horario`

La opción más simple y consistente con el repo es un panel inline expandible por tarjeta o un menú liviano. No hace falta modal global.

### 3. Estado local optimista

La UX pedida se puede resolver de dos maneras:

- optimista real
- refresco de calendario tras guardar

Mi recomendación para este repo:

- optimismo local por dosis
- fallback a refetch de la semana si la escritura falla o cuando termina

Implementación sugerida:

- `PatientWeeklyCalendar` conserva el estado del calendario semanal
- exponer un callback `onDoseStatusChange`
- al hacer click:
  - actualizar la dosis localmente
  - marcarla como “guardando”
  - llamar al servicio
  - si falla, revertir
  - opcionalmente refetchear la semana al final para reconciliar

## Colores y mapping visual

El mapping ya existe casi completo en `patient-weekly-calendar-dose.tsx`.

Mantener:

- `taken` -> verde
- `taken_late` -> naranja
- `missed` -> rojo
- `pending` -> gris

Solo hay que asegurar que:

- después del click el badge cambie en el acto
- el color de la card también pueda reforzar el estado si quieren mejorar la percepción

## Estructura de archivos recomendada

### Backend

- `app/api/patient/calendar/logs/route.ts`
- `lib/calendar/logging.ts`
- `lib/calendar/types.ts`
- `lib/calendar/weekly-calendar.ts`

### Frontend

- `services/patient/patient-service.ts`
- `components/mediya/patient/patient-weekly-calendar.tsx`
- `components/mediya/patient/patient-weekly-calendar-day.tsx`
- `components/mediya/patient/patient-weekly-calendar-dose.tsx`

### Base de datos

- nueva migración en `supabase/migrations/*_weekly_schedule_logs_taken_at.sql`

## Plan de implementación por etapas

### Etapa 1. Ajuste de schema

1. Crear migración para `taken_at`.
2. Aplicarla.
3. Verificar que no rompe el builder actual.

### Etapa 2. Tipos y modelo

1. Extender tipos de logs y dosis.
2. Agregar payload/response de escritura.
3. Incluir `taken_at` en el builder de lectura.

### Etapa 3. Endpoint de escritura

1. Crear `POST /api/patient/calendar/logs`.
2. Validar paciente autenticado.
3. Validar ownership.
4. Validar `slot_key`, fecha y weekday.
5. Crear o actualizar log.
6. Devolver log final normalizado.

### Etapa 4. Servicio cliente

1. Agregar `upsertPatientCalendarLog()` en `services/patient/patient-service.ts`.
2. Mantener el mismo patrón de auth bearer ya usado en el módulo paciente.

### Etapa 5. UI interactiva

1. Hacer clickable cada dosis.
2. Mostrar las 3 acciones.
3. Aplicar cambio optimista.
4. Reconciliar con respuesta del backend.
5. Mostrar error inline si falla.

### Etapa 6. Hardening mínimo

1. Probar que un paciente no pueda editar dosis de otro.
2. Probar creación inicial de log.
3. Probar update de un log existente.
4. Probar transición:
   - `pending -> taken`
   - `taken -> missed`
   - `missed -> taken_late`

## Consideraciones de implementación

### 1. No usar Supabase directo desde componentes cliente

Seguir la convención actual del repo:

- componente cliente
- `services/patient/*`
- route handler
- `createAdminSupabaseClient()`

### 2. No reimplementar la expansión semanal en la UI

La semana ya se construye del lado server en `lib/calendar/weekly-calendar.ts`. Eso está bien y debe mantenerse.

### 3. No acoplar este feature a reposición de recetas

Adherencia y refill son conceptos distintos en el código actual. Pueden cruzarse después, pero en esta iteración deben quedar separados.

### 4. No abrir edición médica todavía

El brief dice que el médico no necesita editar estos logs. Entonces el alcance debe quedar únicamente dentro del flujo paciente.

## Resultado esperado al finalizar

Cuando el feature esté implementado:

- el paciente verá su semana como hoy
- cada toma será interactiva
- al elegir una acción se creará o actualizará un registro en `weekly_schedule_logs`
- el cambio se reflejará inmediatamente en la UI
- la API validará que solo el dueño de la toma pueda editarla
- el modelo quedará listo para calcular adherencia semanal y anomalías en una iteración posterior

## Decisión final

La adaptación correcta de `Calendario4` a este codebase es:

- reutilizar `patient_medications` como entidad base de prescripción
- reutilizar `weekly_schedule_configs` y `weekly_schedule_logs`
- agregar solo una migración pequeña para `taken_at`
- implementar un endpoint paciente de upsert de logs
- volver interactiva la UI semanal ya existente

No hace falta rediseñar el calendario ni cambiar la estructura central de tratamientos.
