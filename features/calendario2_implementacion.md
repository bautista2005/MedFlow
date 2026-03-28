# MEDIYA — Implementación adaptada de `Calendario2`

## 1. Objetivo real del feature

Extender el flujo actual de alta de tratamiento en el panel médico para que, en la misma acción de guardado, se pueda crear opcionalmente la configuración del calendario semanal del tratamiento.

La adaptación debe respetar el proyecto real:

- la entidad principal del tratamiento es `public.patient_medications`
- la capa opcional de calendario ya existe en `public.weekly_schedule_configs`
- la lectura del calendario ya está contemplada en los endpoints de detalle médico y dashboard del paciente
- la lógica de agotamiento y reposición sigue viviendo en `lib/patient/medication-calculations.ts`

## 2. Estado actual verificado

### 2.1 Arquitectura

- Frontend: Next.js App Router, React 19, TypeScript, Tailwind v4
- Backend HTTP: `app/api/**/route.ts`
- Acceso sensible a datos: `createAdminSupabaseClient()`
- Autorización: `requireAuthenticatedDoctor()` y `requireAuthenticatedPatient()`
- Servicios browser-side: `services/doctor/doctor-service.ts` y `services/patient/patient-service.ts`

### 2.2 Tablas reales involucradas

- `patients`
- `patient_doctors`
- `patient_medications`
- `weekly_schedule_configs`
- `weekly_schedule_logs`
- `prescription_requests`
- `prescription_files`

### 2.3 Relaciones reales

- `patient_medications.patient_id -> patients.patient_id`
- `patient_medications.active_doctor_id -> active_doctors.active_doctor_id`
- `weekly_schedule_configs.patient_medication_id -> patient_medications.patient_medication_id`
- `weekly_schedule_configs.patient_id -> patients.patient_id`
- `weekly_schedule_configs.active_doctor_id -> active_doctors.active_doctor_id`
- `weekly_schedule_logs.weekly_schedule_config_id -> weekly_schedule_configs.weekly_schedule_config_id`

### 2.4 Lo que ya existe hoy

- La migración `supabase/migrations/20260328200000_weekly_schedule_calendar.sql` ya creó `weekly_schedule_configs` y `weekly_schedule_logs`.
- `lib/calendar/types.ts` ya define `WeeklyScheduleInput`, `WeeklyScheduleConfigSummary` y `WeeklyScheduleLogSummary`.
- `lib/calendar/utils.ts` ya normaliza la relación `weekly_schedule_configs`.
- `app/api/doctor/patients/[patientId]/route.ts` ya devuelve `weekly_schedule` dentro de cada tratamiento.
- `app/api/patient/dashboard/route.ts` ya devuelve `weekly_schedule` para el paciente.
- `app/api/doctor/patients/[patientId]/medications/route.ts` ya intenta crear la config semanal si viene en el payload.

## 3. Brecha entre el brief y el codebase actual

El brief de `features/Calendario2.md` asume un flujo de tratamiento más rico que el formulario hoy expuesto en UI.

Hoy el formulario real `components/mediya/doctor/patient-treatment-form.tsx` solo envía:

- `medication_name`
- `daily_dose`
- `interval_hours`
- `pills_per_box`
- `box_count`
- `start_date`

Y recién en la API se deriva:

- `dose_text`
- `frequency_text`
- `units_per_intake`
- `intakes_per_day`

Además, hoy el guardado de tratamiento + calendario:

- no usa transacción SQL real
- hace rollback manual borrando `patient_medications` si falla `weekly_schedule_configs`
- no valida en profundidad la coherencia del calendario antes de insertar
- no expone la sección de calendario en el formulario
- no muestra en la UI médica una señal clara de si el tratamiento quedó dentro del calendario

## 4. Criterio de adaptación

Para alinearlo al proyecto actual, la implementación correcta no debe:

- crear una tabla nueva de `prescriptions`
- duplicar `medication_name`, `dose_text`, `frequency_text`, `pills_per_box`, `box_count`, `units_per_intake` o `intakes_per_day` dentro del calendario
- reimplementar los cálculos de reposición

Sí debe:

- mantener `patient_medications` como fuente de verdad del tratamiento
- usar `weekly_schedule_configs` como capa opcional 1 a 1 por tratamiento
- crear todo en una sola operación transaccional
- dejar el resultado listo para la lectura actual del paciente

## 5. Diseño funcional adaptado

### 5.1 Comportamiento de UI

En `components/mediya/doctor/patient-treatment-form.tsx` agregar:

- un toggle o checkbox `Agregar este tratamiento al calendario semanal`
- una sección expandible visible solo si el toggle está activo

Campos de esa sección:

- `days_of_week: number[]`
- `times_per_day: number`
- `intake_slots: { slot_key, label, time }[]`
- `notes: string`

Adaptación importante:

- `times_per_day` debe ser solo un helper de UI para renderizar filas de tomas
- no debe persistirse como columna nueva
- la persistencia real sigue siendo `intake_slots`

### 5.2 Regla de coherencia con el tratamiento

Como el tratamiento actual ya define la frecuencia mediante `interval_hours`, el calendario no debe contradecirla.

Regla propuesta:

- `intakes_per_day` del tratamiento se sigue derivando como `24 / interval_hours`
- si el calendario está habilitado, la cantidad de `intake_slots` debe coincidir con ese valor derivado

Esto evita que el médico configure, por ejemplo:

- tratamiento cada 12 hs
- pero 3 tomas diarias en el calendario

Si más adelante quieren permitir calendarios clínicamente distintos del texto de frecuencia, eso ya sería otro cambio de dominio, no este feature.

## 6. Validación adaptada

La validación principal debe vivir en `lib/doctor/patient-medication.ts`.

### 6.1 Tratamiento base

Se conserva la validación ya existente sobre:

- `medication_name`
- `daily_dose`
- `interval_hours`
- `pills_per_box`
- `box_count`
- `start_date`

### 6.2 Calendario opcional

Si `weekly_schedule` viene presente y habilitado:

- `days_of_week` debe tener al menos un día
- cada día debe estar entre `0` y `6`
- `intake_slots` debe tener al menos una toma
- cada `slot_key` debe ser único y no vacío
- `time`, si existe, debe cumplir `HH:MM`
- `schedule_end_date`, si existe, debe ser `>= schedule_start_date`
- la cantidad de `intake_slots` debe coincidir con `24 / interval_hours`

Normalizaciones:

- `schedule_start_date` debe caer en `start_date` si no se envía explícitamente
- `notes` vacías deben convertirse a `null`
- `label` vacía debe convertirse a `null`
- `time` vacía debe convertirse a `null`

## 7. Persistencia correcta

### 7.1 Qué ya está bien del modelo SQL

`weekly_schedule_configs` ya está bien alineada al proyecto porque:

- referencia a `patient_medication_id`
- replica `patient_id` y `active_doctor_id` para consultas más simples
- tiene `unique (patient_medication_id)`
- valida `days_of_week` e `intake_slots`
- tiene trigger de consistencia contra `patient_medications`

### 7.2 Qué está mal hoy en la escritura

La ruta actual inserta:

1. `patient_medications`
2. luego `weekly_schedule_configs`
3. y si falla lo segundo, borra lo primero

Eso no cumple estrictamente con el requisito de transacción.

### 7.3 Solución alineada al estilo del repo

La solución más consistente con este codebase es agregar una RPC de Postgres, análoga al patrón de `claim_approved_doctor_registration(...)`.

Propuesta:

- nueva función `public.create_patient_treatment_with_optional_schedule(...)`
- `language plpgsql`
- `security definer`
- `grant execute` solo a `service_role`

Responsabilidades de la función:

1. validar que exista la relación en `patient_doctors`
2. calcular `intakes_per_day` y `units_per_intake`
3. insertar `patient_medications`
4. insertar `weekly_schedule_configs` solo si corresponde
5. devolver `patient_medication_id` y opcionalmente `weekly_schedule_config_id`

Beneficio:

- toda la operación ocurre dentro de una transacción nativa de Postgres
- desaparece el rollback manual desde TypeScript
- la regla de consistencia queda cerca de los datos

## 8. Cambios de backend propuestos

### 8.1 `supabase/migrations/*`

Agregar una nueva migración con la RPC transaccional. No hace falta crear tablas nuevas.

### 8.2 `lib/doctor/patient-medication.ts`

Extender:

- `normalizeWeeklyScheduleInput(...)`
- `validatePatientTreatmentInput(...)`

Para que validen:

- coherencia entre frecuencia e `intake_slots`
- unicidad de `slot_key`
- formato de horarios
- fechas del calendario

### 8.3 `app/api/doctor/patients/[patientId]/medications/route.ts`

Reemplazar la doble inserción manual por:

- validación del request
- llamada a `supabase.rpc("create_patient_treatment_with_optional_schedule", ...)`
- mapeo de errores a mensajes de UI

La ruta debe quedar como controller fino, no como lugar de lógica transaccional.

## 9. Cambios de frontend propuestos

### 9.1 `components/mediya/doctor/patient-treatment-form.tsx`

Agregar:

- estado local para `weekly_schedule_enabled`
- selector de días
- input helper para `times_per_day`
- render dinámico de filas de `intake_slots`
- campo opcional de notas

Payload final:

- si el toggle está apagado, no mandar `weekly_schedule`
- si está prendido, mandar `weekly_schedule` completo

### 9.2 `services/doctor/doctor-service.ts`

No requiere rediseño. Solo debe seguir enviando el payload expandido.

### 9.3 `components/mediya/doctor/patient-detail-panel.tsx`

Ya recibe `weekly_schedule` desde la API. Solo falta mostrarlo.

Indicaciones visuales mínimas por tratamiento:

- badge `Calendario semanal activo` si `weekly_schedule?.is_enabled === true`
- badge neutro `Sin calendario semanal` si no existe config

Resumen opcional útil en la card:

- días configurados
- cantidad de tomas
- horarios si fueron cargados

## 10. Impacto en paciente

El dashboard del paciente ya está preparado para recibir `weekly_schedule` porque:

- `app/api/patient/dashboard/route.ts` ya incluye `weekly_schedule_configs(...)`
- `lib/patient/types.ts` ya define `weekly_schedule: WeeklyScheduleConfigSummary | null`

Entonces este feature deja la lectura del paciente lista a nivel de datos sin tocar:

- `prescription_requests`
- `prescription_files`
- `calculateMedicationStatus(...)`

## 11. Criterios de aceptación adaptados al proyecto

- Crear tratamiento sin calendario sigue funcionando igual que hoy.
- Crear tratamiento con calendario crea `patient_medications` y `weekly_schedule_configs` en una única operación transaccional.
- Si el calendario es inválido, no se crea el tratamiento.
- La lógica de reposición en `lib/patient/medication-calculations.ts` no cambia.
- El detalle del paciente muestra si el tratamiento tiene calendario semanal.
- El dashboard del paciente sigue pudiendo leer el tratamiento sin cambios de contrato.

## 12. Archivos concretos a tocar

- `supabase/migrations/<timestamp>_create_patient_treatment_with_optional_schedule.sql`
- `lib/doctor/patient-medication.ts`
- `app/api/doctor/patients/[patientId]/medications/route.ts`
- `components/mediya/doctor/patient-treatment-form.tsx`
- `components/mediya/doctor/patient-detail-panel.tsx`

## 13. Decisión final

La adaptación correcta de `Calendario2` para este proyecto no consiste en inventar un módulo nuevo, sino en cerrar una implementación que ya está parcialmente iniciada:

- el modelo SQL ya existe
- los tipos ya existen
- las lecturas ya existen
- falta completar bien la escritura transaccional, la validación y la UI médica

Ese es el camino más consistente con el codebase actual, con la base real en Supabase y con el estilo de diseño de datos que ya usa MEDIYA.
