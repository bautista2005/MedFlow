# Plan técnico adaptado: Centro de notificaciones del paciente

## Estado actual relevado

El codebase hoy no tiene un sistema general de notificaciones persistidas. Lo que existe está repartido entre módulos:

- El paciente ve tratamientos y pedidos en `app/api/patient/dashboard/route.ts`.
- El calendario semanal se consume aparte desde `app/api/patient/calendar/route.ts`.
- Los pedidos de receta se crean en `app/api/patient/requests/route.ts`.
- La resolución práctica del pedido hoy ocurre cuando el médico sube un archivo en `app/api/doctor/requests/[requestId]/files/route.ts`.

Conclusión: hoy MedFlow expone estados y eventos, pero no los consolida en un feed unificado para el paciente. La implementación correcta no es agregar otra columna sobre recetas, sino introducir una tabla central de notificaciones del paciente y empezar a emitir eventos desde los flujos ya existentes.

## Cambio de schema realizado

Se agregó una nueva migración local y se aplicó en Supabase:

- `supabase/migrations/20260328234500_patient_notifications_mvp.sql`

La migración crea `public.patient_notifications` como tabla central del MVP.

## 1. Modelo de datos recomendado

Tabla central: `public.patient_notifications`

Campos implementados:

- `patient_notification_id`
- `patient_id`
- `active_doctor_id` nullable
- `patient_medication_id` nullable
- `prescription_request_id` nullable
- `weekly_schedule_config_id` nullable
- `source`
- `category`
- `type`
- `title`
- `message`
- `status`
- `priority`
- `action_url`
- `metadata jsonb`
- `scheduled_for`
- `read_at`
- `created_at`
- `updated_at`
- `dedupe_key`

Decisiones de modelado:

- La entidad principal es `patient_id`, no `auth_user_id`, porque el dominio actual del producto ya trabaja sobre `patients`, `patient_medications`, `prescription_requests` y `weekly_schedule_configs`.
- `metadata` queda como válvula de escape para MVP. Permite crecer sin cambiar schema por cada nuevo caso.
- Se agregan FKs opcionales a entidades actuales del producto para facilitar joins, trazabilidad y futuras pantallas accionables.
- `type` queda abierto y extensible; `category` sí queda acotada por check para no degradar el feed con valores arbitrarios.
- `dedupe_key` evita duplicados para recordatorios o eventos reintentados.

## 2. Categorías y tipos que conviene definir ahora

Categorías recomendadas para este repo:

- `calendar`
- `prescription`
- `doctor_message`
- `system`

Tipos concretos recomendados para MVP y siguiente iteración:

- `calendar_dose_reminder`
- `calendar_missed_dose`
- `prescription_request_created`
- `prescription_request_reviewed`
- `prescription_request_accepted`
- `prescription_request_rejected`
- `prescription_file_uploaded`
- `doctor_observation_created`
- `medication_running_low`
- `follow_up_reminder`

Regla práctica:

- `category` se usa para agrupar y filtrar en UI.
- `type` se usa para lógica puntual, analytics, copy y deduplicación.

## 3. Qué integra bien con el codebase actual

### Recetas / pedidos

Es el primer flujo que debe emitir notificaciones porque ya existe de punta a punta.

Puntos concretos:

- `app/api/patient/requests/route.ts`
  - crear `prescription_request_created` cuando el paciente genera un pedido
- `app/api/doctor/requests/[requestId]/files/route.ts`
  - crear `prescription_file_uploaded`
  - crear `prescription_request_accepted` o `prescription_request_rejected` según el estado final

Metadatos recomendados:

- `prescription_request_id`
- `patient_medication_id`
- `pharmacy_name`
- `resolved_status`
- `file_uploaded_at`

### Calendario semanal

El calendario ya existe como lectura y logging, pero todavía no genera notificaciones.

Puntos concretos:

- `lib/calendar/weekly-calendar.ts` sigue siendo la fuente de verdad para construir dosis de la semana
- futuros recordatorios deben terminar insertando `calendar_dose_reminder` en `patient_notifications`
- si más adelante se decide notificar tomas omitidas, el evento puede nacer desde `app/api/patient/calendar/logs/route.ts` o desde una tarea programada que revise faltantes

Para MVP de hackathon:

- no hace falta push real
- no hace falta scheduler en esta primera entrega
- sí conviene dejar la tabla preparada para que un cron o Edge Function inserte recordatorios después

### Observaciones del médico

Todavía no existe una tabla o flujo específico de mensajes clínicos. Para MVP no hace falta crear una tabla nueva separada si el objetivo es solo notificar.

Estrategia recomendada:

- cuando se implemente la futura acción del médico, insertar directamente una notificación `doctor_observation_created`
- guardar el contenido mínimo en `title`, `message` y `metadata`

Si en una iteración posterior el producto necesita historial conversacional o edición de mensajes, ahí sí convendrá una tabla propia de observaciones, con `patient_notifications` actuando como proyección/feed.

### Sistema / recordatorios generales

Casos como “te quedan pocos días de medicación” o “deberías pedir nuevo turno” no requieren tablas nuevas.

Pueden salir de lógica sobre entidades existentes:

- `patient_medications`
- `prescription_requests`
- `weekly_schedule_logs`
- `next_consultation_at`
- `calculateMedicationStatus(...)` en `lib/patient/medication-calculations.ts`

La regla correcta es:

- la lógica se calcula desde los datos del dominio actual
- el resultado persistido para mostrar al paciente vive en `patient_notifications`

## 4. API y servicio recomendados

Para mantener la arquitectura vigente del repo, el cliente no debe leer ni escribir Supabase directo. Debe pasar por route handlers y `services/*`.

Nuevos endpoints recomendados:

- `GET /api/patient/notifications`
  - lista el feed del paciente autenticado
  - soporte para `status=unread|read|all` opcional
- `PATCH /api/patient/notifications/[notificationId]`
  - marcar una notificación como leída
- `POST /api/patient/notifications/read-all`
  - marcar todo como leído

Nuevos tipos y servicio recomendados:

- `lib/patient/types.ts`
  - agregar `PatientNotificationCategory`
  - agregar `PatientNotificationType`
  - agregar `PatientNotificationStatus`
  - agregar `PatientNotificationSummary`
- `services/patient/patient-service.ts`
  - `listPatientNotifications()`
  - `markPatientNotificationAsRead(notificationId)`
  - `markAllPatientNotificationsAsRead()`

## 5. UI recomendada en el dashboard paciente

Hoy el panel del paciente vive en `components/mediya/patient/patient-dashboard.tsx` y en la columna derecha muestra solo `PatientRequestTracker`.

Cambio recomendado:

- sumar un bloque `PatientNotificationCenter`
- mantener el tracker de pedidos por ahora, pero dejar de pensarlo como el centro principal de alertas

Estructura sugerida:

- `components/mediya/patient/patient-notification-center.tsx`
- `components/mediya/patient/patient-notification-item.tsx`

Comportamiento MVP:

- listar todo mezclado en orden descendente por `created_at`
- badge visual por `category`
- estilo distinto para `unread`
- CTA opcional usando `action_url`

Ejemplos de `action_url`:

- `/paciente`
- `/paciente?tab=pedidos`
- `/paciente?tab=calendario`

Si no existe aún una navegación por tabs, `action_url` puede apuntar por ahora a `/paciente` y el frontend resolver luego el refinamiento.

## 6. Estrategia de emisión de notificaciones

Para este codebase, la forma más simple y consistente es:

1. Crear un helper server-side reutilizable.
2. Llamarlo desde route handlers existentes cuando ocurre el evento real.
3. Persistir siempre una fila final en `patient_notifications`.

Helper recomendado:

- `lib/patient/notifications.ts`

Funciones sugeridas:

- `createPatientNotification(...)`
- `createPrescriptionRequestNotification(...)`
- `createCalendarReminderNotification(...)`
- `markPatientNotificationRead(...)`

Motivo para no usar triggers en esta etapa:

- el producto todavía está en MVP
- la lógica de copy y `action_url` vive mejor cerca del caso de uso de aplicación
- hoy los cambios relevantes ya pasan por route handlers controlados

## 7. Qué no conviene hacer ahora

No conviene para este MVP:

- crear subsistemas separados de notificaciones por recetas y por calendario
- crear una tabla extra solo para “bandeja” o “notification_center”
- implementar push, email o WhatsApp
- meter lógica de notificaciones en componentes cliente
- generar notificaciones calculadas en cada render sin persistencia
- duplicar estados de recetas dentro de la tabla de notificaciones

La tabla de notificaciones debe guardar el evento presentado al paciente, no reemplazar la fuente de verdad del dominio.

## 8. Orden de implementación seguro

Orden recomendado para avanzar sin romper lo actual:

1. Dejar `patient_notifications` como nueva tabla base.
2. Agregar tipos y servicio cliente.
3. Crear `GET /api/patient/notifications`.
4. Emitir notificaciones desde recetas:
   - creación de pedido
   - carga de receta
   - aceptación/rechazo
5. Agregar el centro de notificaciones al dashboard paciente.
6. Agregar `PATCH` para marcar como leída.
7. Recién después sumar recordatorios de calendario y recordatorios generales.

## 9. Propuesta MVP concreta

La adaptación correcta de `Notificacion1.md` a este proyecto es:

- una sola tabla central: `patient_notifications`
- feed único para el paciente
- persistencia backend primero
- integración inicial solo con eventos de recetas, porque ese flujo ya existe
- calendario, observaciones médicas y recordatorios generales preparados desde el modelo, aunque no todos emitidos en la primera iteración

En otras palabras:

- sí conviene agregar schema ahora
- no conviene esperar a tener push o mensajería completa
- el MVP debe empezar con persistencia unificada y con uno o dos productores reales de eventos

## 10. Resumen ejecutivo

El sistema actual de MedFlow ya tiene los dominios correctos: tratamientos, calendario semanal y pedidos de receta. Lo que falta es una capa transversal para presentar eventos al paciente de forma unificada.

La decisión correcta para este repo es usar una sola tabla `patient_notifications`, conectada a `patients` y con referencias opcionales a `patient_medications`, `prescription_requests` y `weekly_schedule_configs`. Esa tabla ya quedó creada en la base y versionada en migraciones.

La primera implementación útil debe arrancar por recetas, porque es el flujo más completo hoy. Luego se suma lectura/marcado de notificaciones en el dashboard paciente. Los recordatorios del calendario y las observaciones médicas quedan soportados por el modelo sin obligar a rehacer el sistema más adelante.
