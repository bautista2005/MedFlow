# Implementacion de Notificacion4 en MedFlow

## 1. Resumen ejecutivo

La integracion entre calendario semanal y notificaciones generales ya tiene una base real en el proyecto:

- existe una tabla unificada `public.patient_notifications`
- el calendario semanal ya vive en `weekly_schedule_configs` y `weekly_schedule_logs`
- el dominio de notificaciones ya contempla `category = 'calendar'`
- ya existe un helper `createCalendarNotification(...)` en `lib/patient/notifications.ts`
- hoy ya se genera una notificacion cuando el paciente registra una toma como `missed` desde `lib/calendar/logging.ts`

Por lo tanto, la adaptacion correcta de `Notificacion4` no es crear un sistema nuevo. La implementacion debe completar el MVP actual para que el modulo semanal pueda emitir notificaciones generales del calendario de forma controlada, sin duplicar estructuras ni romper los flujos existentes.

La fuente de verdad debe seguir siendo `public.patient_notifications`, no una tabla aparte llamada `notifications`.

## 2. Analisis del sistema actual

### Arquitectura general

El proyecto ya esta organizado en capas claras:

- UI del paciente en `app/(patient)/*` y `components/mediya/patient/*`
- route handlers en `app/api/*`
- servicios cliente en `services/*`
- logica de negocio compartida en `lib/*`
- esquema y contratos de datos en `supabase/migrations/*`

Para este feature, los puntos de integracion reales son:

- calendario semanal:
  - `app/api/patient/calendar/route.ts`
  - `app/api/patient/calendar/logs/route.ts`
  - `lib/calendar/weekly-calendar.ts`
  - `lib/calendar/logging.ts`
  - `lib/calendar/types.ts`
- notificaciones:
  - `app/api/patient/notifications/*`
  - `services/patient/patient-service.ts`
  - `lib/patient/notifications.ts`
  - `lib/patient/types.ts`
  - `components/mediya/patient/patient-notifications-panel.tsx`
  - `components/mediya/patient/patient-notification-item.tsx`

### Flujo actual de datos

1. El calendario semanal del paciente se construye desde `lib/calendar/weekly-calendar.ts` leyendo:
   - `patient_medications`
   - `weekly_schedule_configs`
   - `weekly_schedule_logs`

2. El paciente registra una toma desde `POST /api/patient/calendar/logs`.

3. `lib/calendar/logging.ts` valida pertenencia, rango de fechas, dia habilitado y `slot_key`, luego hace upsert en `weekly_schedule_logs`.

4. Si el estado registrado es `missed`, hoy ya se llama a `createCalendarNotification(...)`.

5. El feed general de notificaciones del paciente se consume desde:
   - `GET /api/patient/notifications`
   - `PATCH /api/patient/notifications/[notificationId]`
   - `POST /api/patient/notifications/read-all`

6. La UI ya tiene una pantalla dedicada en `/paciente/notificaciones` y tambien un resumen dentro del dashboard.

## 3. Analisis de base de datos

### Tablas relevantes

#### `public.weekly_schedule_configs`

Representa la configuracion semanal de un tratamiento:

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

Observaciones:

- hay una sola configuracion por tratamiento por la restriccion `unique (patient_medication_id)`
- `intake_slots` ya contiene `slot_key`, `label` y `time`, que son suficientes para construir recordatorios

#### `public.weekly_schedule_logs`

Persistencia de adherencia del calendario:

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
- `logged_at`
- `taken_at`

Observaciones:

- ya existe deduplicacion natural por dosis mediante `unique (weekly_schedule_config_id, scheduled_for_date, slot_key)`
- esta tabla sirve para detectar si una toma sigue pendiente o ya fue registrada

#### `public.patient_notifications`

Tabla unificada del sistema de notificaciones:

- relaciones opcionales a paciente, medico, tratamiento, pedido y calendario semanal
- `source`, `category`, `type`
- `title`, `message`
- `status`, `priority`
- `action_url`
- `metadata`
- `scheduled_for`
- `dedupe_key`

Observaciones:

- ya soporta `source = 'calendar'` y `category = 'calendar'`
- ya tiene `weekly_schedule_config_id`
- ya tiene indice unico `(patient_id, dedupe_key)` para evitar duplicados obvios
- no hace falta crear una nueva tabla para este feature

## 4. Estado actual frente al requerimiento de Notificacion4

### Ya resuelto

- existe una tabla unificada de notificaciones
- el dominio ya contempla notificaciones del calendario
- ya hay helper reutilizable para crear notificaciones `category = 'calendar'`
- ya se guarda metadata util:
  - `patient_medication_id`
  - `weekly_schedule_config_id`
  - `medication_name`
  - `scheduled_for_date`
  - `slot_key`
  - `slot_label`
  - `scheduled_time`
- ya existe una pantalla relevante y navegable para el paciente:
  - `/paciente/notificaciones`
  - `/paciente`
- ya existe deduplicacion por `dedupe_key`

### Parcialmente resuelto

- el caso de toma pendiente ya existe solo cuando el paciente la marca como omitida manualmente
- el caso de recordatorio de toma proxima existe en helper y tipos, pero no tiene disparador real

### Pendiente

- una capa clara para generar recordatorios automáticos de dosis proximas
- una capa clara para generar pendientes vencidas sin depender de la accion manual del paciente
- preparacion para agrupar multiples tomas no registradas
- definicion de un entrypoint invocable por scheduler futuro

## 5. Adaptacion realista al sistema actual

La especificacion habla de una tabla `notifications`, pero en MedFlow la entidad real es `patient_notifications`. Esa debe seguir siendo la unica tabla de persistencia.

La integracion correcta es:

1. conservar `weekly_schedule_configs` y `weekly_schedule_logs` como fuentes del calendario
2. usar `lib/patient/notifications.ts` como capa central de emision
3. agregar una capa de orquestacion para recorrer tomas programadas y crear notificaciones cuando corresponda
4. exponer esa orquestacion mediante una funcion backend clara que luego pueda ser invocada por cron, Edge Function o job

No conviene disparar estas notificaciones desde endpoints de lectura como `GET /api/patient/calendar` o `GET /api/patient/dashboard`, porque mezclar lectura y escritura haria mas dificil controlar duplicados y ventanas de ejecucion.

## 6. Cambios recomendados de backend

### 6.1. Mantener `createCalendarNotification(...)` como puerta de entrada

`lib/patient/notifications.ts` ya es el lugar correcto para encapsular:

- `source = 'calendar'`
- `category = 'calendar'`
- `action_url`
- `metadata`
- `scheduled_for`
- `dedupe_key`

La recomendacion es extender este helper, no reemplazarlo.

### 6.2. Ajustar los tipos de notificacion de calendario

Hoy existen:

- `calendar_dose_reminder`
- `calendar_missed_dose`

Para adaptarse mejor al requerimiento, conviene reinterpretarlos asi:

- `calendar_dose_reminder`
  - recordatorio de toma proxima
- `calendar_missed_dose`
  - recordatorio de toma pendiente o toma vencida no registrada

No es necesario crear otro `type` para el MVP si se quiere minimizar cambios. La diferencia puede quedar en:

- el texto del mensaje
- la `priority`
- metadata adicional como `notification_reason`

### 6.3. Crear una capa orquestadora para notificaciones del calendario

Agregar una nueva funcion de dominio, por ejemplo en `lib/calendar/notifications.ts`, con una responsabilidad explicita:

- buscar tomas elegibles dentro de una ventana de tiempo
- detectar si ya existe log en `weekly_schedule_logs`
- construir el mensaje usando datos del tratamiento
- emitir la notificacion en `patient_notifications`
- apoyarse en `dedupe_key` para evitar duplicados

Responsabilidades sugeridas:

- `emitUpcomingDoseReminders(...)`
- `emitPendingDoseNotifications(...)`
- `emitCalendarNotifications(...)` como fachada principal

Esto mantiene separadas:

- construccion del calendario
- registro de adherencia
- emision de notificaciones

### 6.4. Crear un entrypoint invocable por scheduler futuro

Como el requerimiento pide evitar un scheduler complejo, la salida pragmatica es crear una funcion backend clara y autocontenida, por ejemplo:

- route handler interno protegido
- script server-side
- Edge Function

La recomendacion mas alineada con el repo actual es un route handler `runtime = "nodejs"` o una Edge Function simple, siempre llamando a la misma logica compartida del punto anterior.

Ejemplo de responsabilidad:

- recibir una fecha/hora de referencia opcional
- calcular ventana de recordatorio
- ejecutar emisiones idempotentes
- devolver resumen de lo creado y lo omitido

## 7. Logica funcional recomendada

### 7.1. Recordatorio de toma proxima

Condicion sugerida:

- existe una toma configurada para una fecha/hora cercana
- no existe registro en `weekly_schedule_logs` para esa dosis
- no existe notificacion previa para la misma dosis y misma categoria temporal

Mensaje recomendado:

- si hay hora: `Toma Isotretinoina 20mg a las 20:00`
- si no hay hora: `Tene presente registrar la toma de Isotretinoina hoy`

Datos usados:

- `patient_medications.medication_name`
- `patient_medications.presentation`
- `weekly_schedule_configs.intake_slots[].label`
- `weekly_schedule_configs.intake_slots[].time`
- `scheduled_for_date`

`action_url` recomendado:

- `/paciente`

Alternativa valida:

- `/paciente/notificaciones`

La mejor UX hoy parece ser `/paciente`, porque el calendario semanal ya vive en el dashboard del paciente.

### 7.2. Recordatorio de toma pendiente

Condicion sugerida:

- la dosis ya paso segun `scheduled_for_date + scheduled_time`
- sigue sin fila en `weekly_schedule_logs`
- no se emitio ya una notificacion equivalente

Mensaje recomendado:

- `Todavia no registraste la toma de hoy de Isotretinoina`
- si existe `slot_label`, incluirla para mayor precision

Importante:

- este caso no debe confundirse con el log `missed`
- una notificacion de pendiente no implica alterar la adherencia ni insertar filas en `weekly_schedule_logs`
- el estado clinico se mantiene pendiente hasta que paciente o sistema lo registren

### 7.3. Multiples tomas no registradas

Para el MVP no hace falta implementarlo completo, pero conviene dejar preparada la capa para:

- agrupar por paciente
- agrupar por fecha
- generar una sola notificacion resumen cuando haya varias tomas vencidas

Preparacion minima sugerida:

- helper separado como `buildGroupedPendingDoseNotification(...)`
- metadata estructurada con una lista de slots o un contador `pending_dose_count`

No recomiendo agregar este comportamiento en la primera iteracion, porque complica deduplicacion, mensajes y UX.

## 8. Dedupe y validaciones

### Dedupe

La proteccion principal ya existe en `patient_notifications.dedupe_key`.

Claves recomendadas:

- upcoming:
  - `calendar_dose_reminder:{weeklyScheduleConfigId}:{scheduledDate}:{slotKey}:upcoming`
- pending:
  - `calendar_missed_dose:{weeklyScheduleConfigId}:{scheduledDate}:{slotKey}:pending`

Esto evita colisiones entre:

- recordatorio previo a la toma
- pendiente posterior a la toma

### Validaciones

- no generar recordatorio si ya existe log `taken`, `taken_late` o `missed`
- no generar recordatorio para calendarios deshabilitados
- no generar recordatorio fuera de `schedule_start_date` y `schedule_end_date`
- no generar recordatorio para tratamientos inactivos
- no generar recordatorio para pacientes `disabled`
- tolerar slots sin `time`
  - para esos casos solo conviene permitir recordatorios de dia, no de ventana horaria fina

## 9. Cambios de frontend

Para este feature, el frontend ya esta basicamente resuelto.

### No hace falta crear nuevas pantallas

Ya existen:

- `/paciente/notificaciones`
- resumen en dashboard
- badge de pendientes en la navegacion superior

### Ajustes recomendados

- mejorar el copy de `PatientNotificationItem` para eventos de calendario
- mostrar la hora programada si viene en metadata
- opcionalmente priorizar visualmente notificaciones `category = 'calendar'` y `priority = 'high'`

No es necesario crear nuevos componentes ni nuevos endpoints para cumplir el MVP.

## 10. Cambios de base de datos

### Cambios obligatorios

Ninguno.

El esquema actual ya soporta el feature.

### Cambios opcionales de bajo impacto

Solo si durante la implementacion real aparecen necesidades concretas:

- agregar indice adicional por `scheduled_for` si luego se lista o consulta por ventanas temporales de forma intensiva
- agregar una convención mas estricta de metadata para calendario

No recomiendo nuevas tablas, ni nuevos FKs, ni cambiar la estructura de `weekly_schedule_logs`.

## 11. Edge cases

- dosis sin `time`: notificacion de recordatorio diario, no exacta por hora
- paciente registra la toma justo despues de emitido el recordatorio: la notificacion queda como historial, pero no debe reenviarse
- scheduler corre varias veces: `dedupe_key` debe absorber la repeticion
- cambio de horario o diferencia de timezone:
  - normalizar calculos con una referencia horaria explicita
  - no confiar en el timezone del navegador para decidir emision backend
- tratamiento desactivado luego de generar una notificacion futura:
  - para MVP puede permanecer en historial
  - no hace falta cancelacion retroactiva compleja
- cambio de configuracion semanal:
  - las nuevas ejecuciones deben mirar la configuracion vigente
  - las notificaciones ya emitidas quedan como snapshot historico

## 12. Plan de ejecucion paso a paso

### Fase 1. Consolidacion de dominio

1. Revisar y ajustar `createCalendarNotification(...)` para que el copy distinga claramente:
   - toma proxima
   - toma pendiente
2. Estandarizar metadata minima:
   - `patient_medication_id`
   - `weekly_schedule_config_id`
   - `medication_name`
   - `scheduled_for_date`
   - `scheduled_time`
   - `slot_key`
   - `slot_label`
   - `notification_reason`
3. Ajustar `dedupe_key` para separar upcoming vs pending.

### Fase 2. Orquestacion reusable

1. Crear una nueva capa de dominio para notificaciones del calendario.
2. Implementar una consulta que:
   - lea tratamientos activos con calendario habilitado
   - expanda los slots del periodo relevante
   - descarte dosis ya registradas en `weekly_schedule_logs`
3. Emitir recordatorios usando `createCalendarNotification(...)`.

### Fase 3. Entry point para ejecucion programable

1. Crear un entrypoint backend simple e idempotente.
2. Permitir pasar una fecha/hora de referencia para testing.
3. Retornar un resumen tecnico:
   - procesadas
   - creadas
   - omitidas por duplicado
   - omitidas por log existente

### Fase 4. Pulido de UI

1. Ajustar copy del item de notificacion para calendario.
2. Mostrar datos de horario si existen.
3. Verificar que `action_url` lleve a una pantalla donde el paciente pueda actuar sobre la toma.

### Fase 5. Verificacion

1. Caso upcoming con slot horario y sin log previo.
2. Caso pending con dosis vencida y sin log.
3. Caso duplicated run del job.
4. Caso dosis ya marcada como tomada.
5. Caso calendario deshabilitado.
6. Caso tratamiento inactivo.

## 13. Recomendacion final

La mejor implementacion para `Notificacion4` en este repo es incremental:

- mantener `patient_notifications` como tabla unica
- reutilizar `createCalendarNotification(...)`
- agregar una capa orquestadora del calendario
- exponer una funcion invocable por scheduler futuro
- no introducir infraestructura compleja ni nuevas tablas en esta etapa

En terminos practicos, el feature no parte de cero. Ya existe alrededor del 60-70% de la base tecnica. El trabajo real restante es convertir el soporte actual de notificaciones del calendario, hoy reactivo y parcial, en una emision programable e idempotente para recordatorios de tomas proximas y pendientes.
