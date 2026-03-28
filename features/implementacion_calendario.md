# MEDIYA — Implementación adaptada del módulo Calendario

## 1. Propósito

Este documento reemplaza conceptualmente a `features/Calendario.md` como base para la futura implementación del calendario semanal de seguimiento, pero adaptado al estado real del proyecto.

No describe una app nueva ni una base de datos idealizada. Define cómo agregar el módulo sin romper:

- la arquitectura actual con `Next.js App Router` y `app/api/**/route.ts`
- el acceso server-side vía `createAdminSupabaseClient()`
- la tabla real de tratamientos `public.patient_medications`
- la lógica vigente de reposición en `lib/patient/medication-calculations.ts`
- las relaciones actuales entre médico, paciente, tratamiento, pedidos y archivos

## 2. Estado actual verificado

### 2.1 Stack y arquitectura

- `next@16.2.1`
- `react@19.2.4`
- `typescript`
- Tailwind CSS v4
- Supabase Auth + Postgres + Storage
- Route Handlers con `runtime = "nodejs"` para operaciones sensibles

### 2.2 Modelo de dominio vigente

Las tablas públicas relevantes hoy son:

- `approved_doctors`
- `active_doctors`
- `pharmacies`
- `patients`
- `patient_doctors`
- `patient_medications`
- `prescription_requests`
- `prescription_files`

Relaciones ya existentes:

- `active_doctors.auth_user_id -> auth.users.id`
- `patients.auth_user_id -> auth.users.id`
- `patients.created_by_active_doctor_id -> active_doctors.active_doctor_id`
- `patient_doctors.patient_id -> patients.patient_id`
- `patient_doctors.active_doctor_id -> active_doctors.active_doctor_id`
- `patient_medications.patient_id -> patients.patient_id`
- `patient_medications.active_doctor_id -> active_doctors.active_doctor_id`
- `prescription_requests.patient_medication_id -> patient_medications.patient_medication_id`

### 2.3 Fuente de verdad real del tratamiento

El documento original habla de `prescriptions`, pero en este proyecto la fuente de verdad del tratamiento activo es `public.patient_medications`.

Campos vigentes importantes en `patient_medications`:

- `patient_medication_id`
- `patient_id`
- `active_doctor_id`
- `medication_name`
- `presentation`
- `dose_text`
- `frequency_text`
- `pills_per_box`
- `box_count`
- `units_per_intake`
- `intakes_per_day`
- `start_date`
- `next_consultation_at`
- `notes`
- `is_active`

Conclusión:

- no corresponde crear una tabla nueva llamada `prescriptions`
- no corresponde duplicar columnas de tratamiento dentro del calendario
- la relación correcta del calendario debe ser contra `patient_medications`

### 2.4 Cálculos ya existentes

La lógica actual de duración y reposición no está persistida como columnas en SQL. Hoy se deriva en `lib/patient/medication-calculations.ts` a partir de:

- `pills_per_box`
- `box_count`
- `units_per_intake`
- `intakes_per_day`
- `start_date`

Valores derivados hoy:

- unidades diarias
- duración estimada
- días transcurridos
- días restantes
- porcentaje restante
- posibilidad de pedir reposición

Por lo tanto, el calendario semanal no debe intentar reimplementar ni persistir otra copia de esos cálculos.

## 3. Ajustes necesarios sobre la propuesta original

## 3.1 Desalineaciones del archivo original

El archivo `features/Calendario.md` asume:

- una tabla `prescriptions`
- columnas `doctor_id` y `prescription_id`
- campos como `dose`, `unit`, `frequency`, `quantity_per_box`
- valores derivados como `estimated_end_date` almacenados o disponibles directamente

En el codebase real, eso se traduce a:

- `prescription_id` -> `patient_medication_id`
- `doctor_id` -> `active_doctor_id`
- `quantity_per_box` -> `pills_per_box`
- `dose/frequency` legibles -> `dose_text` y `frequency_text`
- `daily_equivalent_dose` estructurado -> `units_per_intake * intakes_per_day`
- `estimated_duration_days` y `estimated_end_date` -> derivados, no persistidos

## 3.2 Restricción funcional correcta para este MVP

El MVP pedido es solo backend/data model. Entonces en esta iteración corresponde:

- crear configuración opcional del calendario por tratamiento
- permitir definir días de la semana y franjas/tomas
- dejar lista la persistencia de adherencia
- no tocar UI
- no tocar todavía el flujo de pedidos
- no crear una tabla de ocurrencias precomputadas

La decisión de no materializar ocurrencias futuras simplifica el modelo y evita duplicar información que puede inferirse desde la configuración semanal.

## 4. Diseño propuesto

## 4.1 Objetivo del diseño

Diseño mínimo, robusto y extensible para soportar:

- calendario semanal opcional por tratamiento
- visualización futura del calendario en la cuenta del paciente
- registro futuro de adherencia por toma
- resúmenes semanales
- detección de faltantes o anomalías sin romper el modelo actual

## 4.2 Nueva tabla `weekly_schedule_configs`

Propósito:

- representar la configuración semanal opcional de un tratamiento
- mantener una relación 1 a 1 con `patient_medications`
- almacenar qué días aplica y cómo se distribuyen las tomas/franjas

Decisiones:

- una sola config por tratamiento activo
- el detalle clínico del medicamento sigue viviendo en `patient_medications`
- la configuración semanal solo agrega la capa de calendario

Columnas propuestas:

- `weekly_schedule_config_id`
- `patient_medication_id`
- `patient_id`
- `active_doctor_id`
- `is_enabled`
- `schedule_start_date`
- `schedule_end_date`
- `days_of_week`
- `intake_slots`
- `notes`
- `created_at`
- `updated_at`

### Campos clave

- `days_of_week smallint[]`
  Guarda los días de la semana en formato `0..6`, donde `0 = domingo`.

- `intake_slots jsonb`
  Guarda un arreglo simple de tomas/franjas. Ejemplo:

```json
[
  { "slot_key": "morning", "label": "Manana", "time": "08:00" },
  { "slot_key": "night", "label": "Noche", "time": "20:00" }
]
```

Esto permite:

- soportar franjas sin crear una tercera tabla en el MVP
- dejar horario opcional
- conservar un identificador estable por toma para loguear adherencia

## 4.3 Nueva tabla `weekly_schedule_logs`

Propósito:

- registrar el estado de adherencia por tratamiento, fecha y toma
- permitir capturar a futuro:
  - `taken`
  - `missed`
  - `taken_late`

Decisiones:

- una fila representa el estado de una toma concreta
- no es un event stream completo por ahora
- se evita sobreingeniería para el MVP

Columnas propuestas:

- `weekly_schedule_log_id`
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
- `created_at`
- `updated_at`

Clave de unicidad:

- `unique (weekly_schedule_config_id, scheduled_for_date, slot_key)`

Esto asegura un solo estado final por toma prevista. Si más adelante se necesita historial de cambios, se podrá agregar una tabla de auditoría sin romper este MVP.

## 4.4 Qué no se duplica

No deben copiarse desde `patient_medications` a las tablas nuevas:

- `medication_name`
- `dose_text`
- `frequency_text`
- `pills_per_box`
- `box_count`
- `units_per_intake`
- `intakes_per_day`
- `start_date`

Esos datos ya existen y siguen siendo la fuente de verdad del tratamiento.

## 4.5 Por qué sí guardar `patient_id` y `active_doctor_id`

Aunque se pueden resolver por join desde `patient_medications`, conviene guardarlos también en ambas tablas nuevas porque:

- simplifican filtros por paciente y por médico
- facilitan endpoints futuros del doctor y del paciente
- mejoran reportes y resúmenes sin depender siempre de joins adicionales
- mantienen el patrón ya usado en `prescription_requests` y `prescription_files`

## 5. Migración SQL propuesta

La siguiente migración está alineada con las convenciones actuales del proyecto:

- tablas en `public`
- `integer generated by default as identity`
- timestamps en UTC
- `set_updated_at()` para `updated_at`
- `enable row level security`
- índices explícitos
- checks simples

```sql
create or replace function public.is_valid_weekday_array(p_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_days is not null
    and coalesce(array_length(p_days, 1), 0) > 0
    and not exists (
      select 1
      from unnest(p_days) as schedule_day
      where schedule_day < 0 or schedule_day > 6
    );
$$;

create table public.weekly_schedule_configs (
  weekly_schedule_config_id integer generated by default as identity primary key,
  patient_medication_id integer not null
    references public.patient_medications (patient_medication_id)
    on delete cascade,
  patient_id integer not null
    references public.patients (patient_id)
    on delete cascade,
  active_doctor_id integer not null
    references public.active_doctors (active_doctor_id)
    on delete restrict,
  is_enabled boolean not null default true,
  schedule_start_date date not null,
  schedule_end_date date null,
  days_of_week smallint[] not null,
  intake_slots jsonb not null default '[]'::jsonb,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint weekly_schedule_configs_patient_medication_unique
    unique (patient_medication_id),
  constraint weekly_schedule_configs_notes_not_blank
    check (notes is null or btrim(notes) <> ''),
  constraint weekly_schedule_configs_schedule_end_after_start
    check (schedule_end_date is null or schedule_end_date >= schedule_start_date),
  constraint weekly_schedule_configs_days_not_empty
    check (coalesce(array_length(days_of_week, 1), 0) > 0),
  constraint weekly_schedule_configs_days_valid
    check (public.is_valid_weekday_array(days_of_week)),
  constraint weekly_schedule_configs_slots_not_empty
    check (jsonb_typeof(intake_slots) = 'array' and intake_slots <> '[]'::jsonb)
);

create index weekly_schedule_configs_patient_id_enabled_idx
  on public.weekly_schedule_configs (patient_id, is_enabled);

create index weekly_schedule_configs_active_doctor_id_enabled_idx
  on public.weekly_schedule_configs (active_doctor_id, is_enabled);

create trigger set_weekly_schedule_configs_updated_at
before update on public.weekly_schedule_configs
for each row
execute function public.set_updated_at();

create table public.weekly_schedule_logs (
  weekly_schedule_log_id integer generated by default as identity primary key,
  weekly_schedule_config_id integer not null
    references public.weekly_schedule_configs (weekly_schedule_config_id)
    on delete cascade,
  patient_medication_id integer not null
    references public.patient_medications (patient_medication_id)
    on delete cascade,
  patient_id integer not null
    references public.patients (patient_id)
    on delete cascade,
  active_doctor_id integer not null
    references public.active_doctors (active_doctor_id)
    on delete restrict,
  scheduled_for_date date not null,
  slot_key text not null,
  scheduled_time time null,
  status text not null,
  recorded_by_role text not null default 'patient',
  recorded_by_auth_user_id uuid null
    references auth.users (id)
    on delete set null,
  note text null,
  logged_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint weekly_schedule_logs_unique_dose
    unique (weekly_schedule_config_id, scheduled_for_date, slot_key),
  constraint weekly_schedule_logs_slot_key_not_blank
    check (btrim(slot_key) <> ''),
  constraint weekly_schedule_logs_status_check
    check (status in ('taken', 'missed', 'taken_late')),
  constraint weekly_schedule_logs_recorded_by_role_check
    check (recorded_by_role in ('patient', 'doctor', 'system')),
  constraint weekly_schedule_logs_note_not_blank
    check (note is null or btrim(note) <> '')
);

create index weekly_schedule_logs_config_date_idx
  on public.weekly_schedule_logs (weekly_schedule_config_id, scheduled_for_date desc);

create index weekly_schedule_logs_patient_date_idx
  on public.weekly_schedule_logs (patient_id, scheduled_for_date desc);

create index weekly_schedule_logs_medication_date_idx
  on public.weekly_schedule_logs (patient_medication_id, scheduled_for_date desc);

create index weekly_schedule_logs_doctor_date_idx
  on public.weekly_schedule_logs (active_doctor_id, scheduled_for_date desc);

create index weekly_schedule_logs_status_date_idx
  on public.weekly_schedule_logs (status, scheduled_for_date desc);

create trigger set_weekly_schedule_logs_updated_at
before update on public.weekly_schedule_logs
for each row
execute function public.set_updated_at();

alter table public.weekly_schedule_configs enable row level security;
alter table public.weekly_schedule_logs enable row level security;
```

## 6. Recomendaciones de integración futura

## 6.1 Alta de tratamiento médico

Cuando el médico cree un tratamiento en `app/api/doctor/patients/[patientId]/medications/route.ts`, se puede extender el payload para aceptar opcionalmente:

- `weekly_schedule_enabled`
- `weekly_schedule.days_of_week`
- `weekly_schedule.intake_slots`
- `weekly_schedule.schedule_start_date`
- `weekly_schedule.schedule_end_date`
- `weekly_schedule.notes`

Si el bloque no viene, solo se crea `patient_medications`.

Si el bloque viene, después del insert del tratamiento se crea también `weekly_schedule_configs`.

## 6.2 Dashboard del paciente

Más adelante `app/api/patient/dashboard/route.ts` podrá sumar:

- config semanal asociada a cada `patient_medication`
- logs recientes o del rango visible

Sin modificar la lógica actual de reposición.

## 6.3 Registro de adherencia

En una iteración futura, el paciente debería registrar adherencia vía un endpoint dedicado, por ejemplo:

- `POST /api/patient/medications/[patientMedicationId]/schedule-logs`

Ese handler deberá:

- validar sesión con `requireAuthenticatedPatient()`
- verificar que la config pertenezca al paciente
- hacer `upsert` lógico sobre la clave única `(weekly_schedule_config_id, scheduled_for_date, slot_key)`

## 7. Decisiones explícitas

- No crear tabla `prescriptions`.
- No duplicar campos clínicos del tratamiento.
- No persistir `estimated_duration_days` ni `estimated_end_date`.
- No crear una tabla de ocurrencias futuras en esta iteración.
- No tocar UI todavía.
- No mezclar calendario semanal con `prescription_requests`.

## 8. Resultado esperado de esta iteración

La feature de calendario queda redefinida correctamente para este codebase:

- usa `patient_medications` como relación base
- agrega solo dos tablas nuevas
- soporta configuración semanal opcional
- soporta logs de adherencia por toma
- no rompe el flujo actual de cálculo de agotamiento y reposición
- deja la base lista para que después el paciente vea su calendario y registre adherencia
