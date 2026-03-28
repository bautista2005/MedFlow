# Calendario semanal del paciente: plan de implementación adaptado a MEDIYA

## Estado real actual del codebase

Después de revisar el repo y la base real de Supabase, el feature no parte de cero:

- El dashboard del paciente vive en `app/(patient)/paciente/page.tsx` y renderiza `components/mediya/patient/patient-dashboard.tsx`.
- El cliente paciente consume `services/patient/patient-service.ts`, que hoy expone `getPatientDashboard()` y `createPatientRequest()`.
- La API del panel paciente está en `app/api/patient/dashboard/route.ts`.
- Los tratamientos activos ya salen de `public.patient_medications`.
- El médico ya puede configurar calendario semanal al crear un tratamiento desde `components/mediya/doctor/patient-treatment-form.tsx`.
- El backend ya crea tratamiento + configuración opcional de calendario con la RPC `public.create_patient_treatment_with_optional_schedule(...)`, invocada desde `app/api/doctor/patients/[patientId]/medications/route.ts`.
- Ya existen tipos y normalizadores base en `lib/calendar/types.ts` y `lib/calendar/utils.ts`.

Conclusión: el gap principal no es de esquema, sino de lectura, expansión semanal y UI del lado paciente.

## Esquema real de Supabase relevante

### Tablas existentes

`public.patient_medications`

- Fuente clínica real del tratamiento.
- Contiene `medication_name`, `presentation`, `dose_text`, `frequency_text`, `units_per_intake`, `intakes_per_day`, `start_date`, `is_active`, `notes`.
- Se relaciona con `patients` y `active_doctors`.

`public.weekly_schedule_configs`

- Ya existe y está vacía en la base actual.
- Una config por tratamiento: `unique (patient_medication_id)`.
- Campos clave:
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `is_enabled`
  - `schedule_start_date`
  - `schedule_end_date`
  - `days_of_week smallint[]` con rango `0..6`
  - `intake_slots jsonb`
  - `notes`

`public.weekly_schedule_logs`

- Ya existe y está vacía en la base actual.
- Registra el estado de una toma concreta.
- Campos clave:
  - `weekly_schedule_config_id`
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `scheduled_for_date`
  - `slot_key`
  - `scheduled_time`
  - `status` en `('taken', 'missed', 'taken_late')`
  - `recorded_by_role`
  - `logged_at`
- Tiene unicidad por dosis: `unique (weekly_schedule_config_id, scheduled_for_date, slot_key)`.

### Relaciones relevantes

- `patient_medications.patient_id -> patients.patient_id`
- `patient_medications.active_doctor_id -> active_doctors.active_doctor_id`
- `weekly_schedule_configs.patient_medication_id -> patient_medications.patient_medication_id`
- `weekly_schedule_configs.patient_id -> patients.patient_id`
- `weekly_schedule_logs.weekly_schedule_config_id -> weekly_schedule_configs.weekly_schedule_config_id`
- `weekly_schedule_logs.patient_medication_id -> patient_medications.patient_medication_id`

### Decisión de esquema

Para este MVP no hace falta agregar ni modificar tablas.

Motivo:

- Ya existe la configuración semanal.
- Ya existe la tabla de logs para soportar los estados visuales.
- Ya existen constraints y triggers de consistencia entre tratamiento, paciente, médico, config y log.

Lo único que falta es usar esas tablas en la capa de lectura y en la UI del paciente.

## Aclaración sobre “prescriptions”

En este codebase no existe una tabla `prescriptions`.

La fuente clínica reutilizable para nombre, dosis, frecuencia y contexto del tratamiento es `public.patient_medications`, y los pedidos/archivos viven en `prescription_requests` y `prescription_files`.

Entonces el calendario debe tomar:

- metadatos clínicos desde `patient_medications`
- configuración semanal desde `weekly_schedule_configs`
- estado registrado desde `weekly_schedule_logs`

## Gap actual exacto

Hoy el paciente recibe esto en `app/api/patient/dashboard/route.ts`:

- perfil
- tratamientos
- pedidos
- resumen simple de `weekly_schedule_configs` dentro de cada tratamiento

Hoy no existe:

- query o función server-side que construya una semana expandida
- lectura de `weekly_schedule_logs` en el panel paciente
- estructura de datos de calendario semanal lista para render
- componentes UI del calendario
- selector de semana actual / anterior / siguiente
- loading separado para ese módulo

## Propuesta de implementación MVP

### 1. Mantener el dashboard y agregar un endpoint específico del calendario

Recomiendo **no meter toda la semana expandida dentro de `PatientDashboardResponse`**.

Conviene crear un endpoint dedicado:

- `app/api/patient/calendar/route.ts`

Razones:

- El selector de semana necesita refetch por rango de fechas.
- Evita agrandar innecesariamente la respuesta de `/api/patient/dashboard`.
- Mantiene separado el módulo nuevo del panel existente.
- Encaja con la convención actual del proyecto: cliente -> `services/*` -> `app/api/*`.

### 2. Crear un builder server-side del calendario semanal

Agregar una función de dominio, idealmente en un archivo nuevo:

- `lib/calendar/weekly-calendar.ts`

Responsabilidad:

- recibir `patientId`
- recibir `weekStart` en formato `YYYY-MM-DD`
- calcular `weekEnd = weekStart + 6 dias`
- leer configs activas del paciente
- leer logs de esa semana
- expandir configs a ocurrencias diarias
- unir cada ocurrencia con su log si existe
- devolver una estructura lista para UI

### 3. Regla de selección de tratamientos/configs

Incluir sólo tratamientos/configs que cumplan:

- `patient_medications.patient_id = patientId`
- `patient_medications.is_active = true`
- `weekly_schedule_configs.is_enabled = true`
- la semana consultada intersecta el rango de la config:
  - `schedule_start_date <= weekEnd`
  - `schedule_end_date is null or schedule_end_date >= weekStart`

Regla recomendada adicional:

- no generar ocurrencias antes de `greatest(patient_medications.start_date, schedule_start_date)`

Esto evita mostrar tomas antes del inicio clínico real del tratamiento.

### 4. Expansión semanal

Por cada `weekly_schedule_config`:

1. Iterar 7 fechas desde `weekStart`.
2. Calcular weekday compatible con Postgres/JS usando el mismo convenio ya persistido en DB:
   - `0 = domingo`
   - `1 = lunes`
   - ...
   - `6 = sábado`
3. Si el día pertenece a `days_of_week`, expandir un item por cada `intake_slot`.

Cada ocurrencia debe incluir como mínimo:

- `date`
- `weekday`
- `patient_medication_id`
- `weekly_schedule_config_id`
- `slot_key`
- `slot_label`
- `slot_time`
- `medication_name`
- `presentation`
- `dose_text`
- `units_per_intake`
- `frequency_text`
- `status`
- `logged_at`
- `note`

### 5. Resolución de estado visual

Mapping propuesto:

- sin log -> `pending`
- `taken` -> `taken`
- `taken_late` -> `taken_late`
- `missed` -> `missed`

Mapping visual:

- `pending` -> gris
- `taken` -> verde
- `taken_late` -> naranja
- `missed` -> rojo

Importante:

- `weekly_schedule_logs` no tiene estado `pending`, así que ese estado debe inferirse por ausencia de log.

### 6. Tipos nuevos

Extender `lib/calendar/types.ts` con tipos específicos de lectura:

- `WeeklyCalendarDoseStatus = "pending" | "taken" | "taken_late" | "missed"`
- `PatientWeeklyCalendarDose`
- `PatientWeeklyCalendarDay`
- `PatientWeeklyCalendarResponse`

Estructura sugerida:

```ts
export type PatientWeeklyCalendarDose = {
  weekly_schedule_config_id: number;
  patient_medication_id: number;
  medication_name: string;
  presentation: string | null;
  dose_text: string;
  units_per_intake: number | null;
  frequency_text: string;
  slot_key: string;
  slot_label: string | null;
  slot_time: string | null;
  scheduled_for_date: string;
  status: "pending" | "taken" | "taken_late" | "missed";
  log_id: number | null;
  logged_at: string | null;
  note: string | null;
};

export type PatientWeeklyCalendarDay = {
  date: string;
  weekday: number;
  label: string;
  is_today: boolean;
  doses: PatientWeeklyCalendarDose[];
};

export type PatientWeeklyCalendarResponse = {
  week_start: string;
  week_end: string;
  has_calendar: boolean;
  days: PatientWeeklyCalendarDay[];
};
```

### 7. Helpers de calendario

En `lib/calendar/utils.ts` o `lib/calendar/weekly-calendar.ts` agregar helpers puros para:

- normalizar `weekStart` al inicio de semana
- sumar días sin depender del huso horario del browser
- formatear labels `Lun 28`, `Mar 29`, etc.
- ordenar tomas:
  - primero por `slot_time`
  - luego por `slot_label`
  - luego por `medication_name`

Dado que el módulo debe ser reusable y server-first, conviene hacer estos cálculos en servidor y no en el componente cliente.

### 8. Endpoint API

Crear:

- `app/api/patient/calendar/route.ts`

Comportamiento:

- `runtime = "nodejs"`
- autenticar con `requireAuthenticatedPatient(request)`
- leer `weekStart` desde querystring
- si no viene, usar la semana actual
- llamar al builder del calendario
- devolver `PatientWeeklyCalendarResponse`

Respuesta vacía válida:

```json
{
  "week_start": "2026-03-23",
  "week_end": "2026-03-29",
  "has_calendar": false,
  "days": []
}
```

### 9. Service layer del paciente

Extender `services/patient/patient-service.ts` con algo así:

```ts
export function getPatientWeeklyCalendar(weekStart?: string) {
  const search = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  return patientFetch<PatientWeeklyCalendarResponse>(`/api/patient/calendar${search}`);
}
```

Esto mantiene intacta la regla del proyecto: los componentes cliente no consultan Supabase directo.

### 10. UI del módulo

Agregar componentes nuevos:

- `components/mediya/patient/patient-weekly-calendar.tsx`
- `components/mediya/patient/patient-weekly-calendar-day.tsx`
- `components/mediya/patient/patient-weekly-calendar-dose.tsx`

Responsabilidades:

`patient-weekly-calendar.tsx`

- manejar estado de semana seleccionada
- fetch con `getPatientWeeklyCalendar`
- renderizar loading, empty state y grilla/cards
- botones anterior / actual / siguiente

`patient-weekly-calendar-day.tsx`

- render de cada día
- encabezado con label y badge si es hoy
- lista de tomas del día

`patient-weekly-calendar-dose.tsx`

- render de cada toma
- mostrar:
  - nombre del medicamento
  - dosis/unidad
  - horario o franja
  - estado visual

### 11. Inserción en el dashboard existente

Renderizar el módulo debajo de “Mis tratamientos” dentro de `components/mediya/patient/patient-dashboard.tsx`.

Orden recomendado:

1. bloque “Mis tratamientos”
2. módulo “Calendario semanal”
3. tracker de pedidos en columna lateral

Si no hay calendario:

- opción A: no renderizar nada
- opción B: mostrar empty state elegante

Para MVP recomiendo **mostrar empty state elegante sólo si hay tratamientos pero ninguno tiene calendario**. Si no hay tratamientos, ya alcanza con el empty state actual de tratamientos.

### 12. Responsive

Desktop:

- grid de 7 columnas o 7 cards en línea horizontal con scroll suave si el ancho no alcanza

Mobile:

- cards apiladas por día

Para no romper el diseño actual de MEDIYA:

- reutilizar `Card`, `Badge`, `Button`
- mantener gradientes suaves azul/emerald y superficies blancas translúcidas
- no introducir un sistema visual paralelo

### 13. Estados de loading

Agregar loading propio del módulo, independiente del dashboard.

Esto es importante porque:

- el dashboard actual hace un fetch global
- el calendario con selector de semana va a necesitar refetch parcial

La UX recomendada:

- primer render: skeleton/placeholder del calendario
- cambio de semana: mantener header visible y reemplazar sólo el contenido diario por estado cargando

### 14. Comentarios y limpieza

El usuario pidió código limpio y comentado.

Aplicación concreta:

- comentarios sólo en la expansión semanal y en la resolución del estado, donde la lógica no sea obvia
- evitar comentarios decorativos en componentes simples

## Archivos a tocar

### Nuevos

- `app/api/patient/calendar/route.ts`
- `components/mediya/patient/patient-weekly-calendar.tsx`
- `components/mediya/patient/patient-weekly-calendar-day.tsx`
- `components/mediya/patient/patient-weekly-calendar-dose.tsx`
- `lib/calendar/weekly-calendar.ts`

### Existentes

- `components/mediya/patient/patient-dashboard.tsx`
- `services/patient/patient-service.ts`
- `lib/calendar/types.ts`
- `lib/calendar/utils.ts`

## Query/data flow propuesto

### Lectura de configs

Desde el endpoint del paciente, consultar:

```sql
patient_medications (
  patient_medication_id,
  medication_name,
  presentation,
  dose_text,
  frequency_text,
  units_per_intake,
  is_active,
  start_date,
  weekly_schedule_configs (
    weekly_schedule_config_id,
    is_enabled,
    schedule_start_date,
    schedule_end_date,
    days_of_week,
    intake_slots,
    notes
  )
)
```

Filtrando por `patient_id` y `is_active = true`.

### Lectura de logs

Consultar `weekly_schedule_logs` por:

- `patient_id`
- `scheduled_for_date >= weekStart`
- `scheduled_for_date <= weekEnd`

Y mapear por clave:

- `${weekly_schedule_config_id}:${scheduled_for_date}:${slot_key}`

Eso permite resolver cada dosis expandida en O(1).

## Decisiones de MVP

### Incluidas

- vista semanal de 7 días
- items por día
- estados visuales
- empty state
- loading
- responsive
- navegación semana anterior / actual / siguiente

### Excluidas por ahora

- edición de logs desde el paciente
- notificaciones
- anomalías
- reprogramación de tomas
- persistencia de preferencia de semana

## Riesgos y cuidados

### 1. Convención de weekday

La DB usa `0..6` y por cómo está cargado el form del médico:

- `0 = domingo`
- `1 = lunes`

La expansión en JS tiene que respetar exactamente eso.

### 2. Fechas y timezone

No conviene construir la semana con `new Date()` sin normalizar porque puede correrse por timezone.

Para MVP:

- trabajar con fechas `YYYY-MM-DD`
- hacer helpers server-side que sumen días sobre strings/UTC controlado

### 3. Estado pendiente

`pending` no existe en DB.

Tiene que ser un estado derivado de “no hay log”.

### 4. Config vacía hoy en producción de prueba

La base actual tiene `weekly_schedule_configs = 0` y `weekly_schedule_logs = 0`.

Entonces el módulo debe quedar robusto con empty state desde el primer deploy.

## Resumen de decisión sobre base de datos

No apliqué cambios de esquema porque no hacen falta para este MVP.

La base actual ya soporta:

- configuración semanal por tratamiento
- trazabilidad por paciente y médico
- logs por toma
- validación de consistencia

Si más adelante se quiere soportar acciones del paciente sobre cada toma, el paso siguiente no sería cambiar la lectura, sino agregar endpoints de escritura sobre `weekly_schedule_logs`.

## Orden recomendado de implementación

1. Extender tipos en `lib/calendar/types.ts`.
2. Implementar builder server-side en `lib/calendar/weekly-calendar.ts`.
3. Crear `app/api/patient/calendar/route.ts`.
4. Extender `services/patient/patient-service.ts`.
5. Crear los tres componentes UI del calendario.
6. Insertar el módulo en `components/mediya/patient/patient-dashboard.tsx`.
7. Probar casos:
   - sin tratamientos
   - con tratamientos sin config
   - con config activa y sin logs
   - con logs `taken`
   - con logs `taken_late`
   - con logs `missed`
   - cambio de semana

## Veredicto final

La feature `Calendario3` se adapta bien al codebase actual y **no requiere cambios de tablas para el MVP**.

La implementación correcta en MEDIYA es:

- mantener `patient_medications` como fuente clínica
- usar `weekly_schedule_configs` como fuente de planificación
- usar `weekly_schedule_logs` como fuente de estado
- resolver la semana en servidor
- exponerla por un endpoint paciente dedicado
- renderizar el módulo debajo de “Mis tratamientos” con componentes nuevos y responsive
