# Plan técnico adaptado: backend inicial del sistema general de notificaciones

## Estado actual relevado

MedFlow ya tiene una base inicial de notificaciones implementada en el codebase y aplicada en Supabase. No corresponde planificar esta feature desde cero.

Lo confirmado en el repositorio y en Supabase es:

- Existe la tabla `public.patient_notifications`.
- Existe migración aplicada: `supabase/migrations/20260328234500_patient_notifications_mvp.sql`.
- Existe módulo server-side: `lib/patient/notifications.ts`.
- Existen endpoints protegidos para paciente:
  - `GET /api/patient/notifications`
  - `PATCH /api/patient/notifications/[notificationId]`
  - `POST /api/patient/notifications/read-all`
- Ya se emiten notificaciones reales desde el flujo de recetas:
  - cuando el paciente crea un pedido en `app/api/patient/requests/route.ts`
  - cuando el médico sube receta y el pedido queda aceptado o rechazado en `app/api/doctor/requests/[requestId]/files/route.ts`

Conclusión: la base de datos y el backend inicial pedidos por `Notificacion2.md` ya existen en versión MVP. El trabajo correcto para este repo es consolidar esa implementación como estándar del sistema general y extenderla a las otras fuentes de eventos.

## Correspondencia entre `Notificacion2.md` y el estado real

### 1. Tabla de notificaciones

Pedido del documento:

- crear tabla `notifications`

Adaptación correcta al codebase actual:

- mantener `public.patient_notifications`

Motivo:

- El dominio ya está centrado en `patients`, no en una tabla genérica de usuarios.
- El feed es únicamente para paciente en esta versión del producto.
- La tabla actual ya incorpora relaciones útiles al dominio real de MedFlow.

Campos existentes hoy:

- `patient_notification_id`
- `patient_id`
- `active_doctor_id`
- `patient_medication_id`
- `prescription_request_id`
- `weekly_schedule_config_id`
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

Comparado con el spec, la tabla actual cubre todo lo pedido y además agrega trazabilidad útil para integración con recetas, doctor y calendario.

### 2. Índices

El spec pide índices razonables. Ya existen:

- `(patient_id, created_at desc)`
- `(patient_id, status, created_at desc)`
- `(patient_id, category, created_at desc)`
- índice parcial por `prescription_request_id`
- índice parcial por `patient_medication_id`
- índice parcial por `weekly_schedule_config_id`
- unique parcial por `(patient_id, dedupe_key)`

Conclusión:

- no hace falta una tabla nueva ni una migración correctiva para índices en esta etapa
- el modelo ya está preparado para listar por paciente, filtrar por estado/categoría y deduplicar eventos

### 3. Foreign keys

El spec pide FKs correctas hacia paciente/usuario.

La adaptación correcta en MedFlow es:

- FK obligatoria a `patients.patient_id`
- FKs opcionales a entidades de negocio relacionadas

FKs actuales:

- `patient_id -> patients`
- `active_doctor_id -> active_doctors`
- `patient_medication_id -> patient_medications`
- `prescription_request_id -> prescription_requests`
- `weekly_schedule_config_id -> weekly_schedule_configs`

Esto está mejor alineado con el producto que una FK genérica a `auth.users`, porque la app ya resuelve permisos y contexto por `patients` y `active_doctors`.

### 4. Tipos / enums

El spec pide tipos o enums si convienen.

En este repo hoy se resolvió con:

- `CHECK constraints` en PostgreSQL
- unions de TypeScript en `lib/patient/types.ts`

Valores actuales:

- `category`: `calendar | prescription | doctor_message | system`
- `status`: `unread | read`
- `priority`: `low | normal | high`
- `source`: `system | doctor | pharmacy | calendar`

Tipos TypeScript actuales:

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

Adaptación recomendada:

- no migrar a enums SQL por ahora
- mantener `type` abierto en DB y tipado del lado TypeScript

Motivo:

- permite crecer sin fricción por feature
- evita migraciones por cada nuevo `type`
- ya es consistente con el resto del repo

## Backend ya implementado

### Repositorio / lógica server-side

`lib/patient/notifications.ts` ya cubre el backend inicial pedido:

- `createPatientNotification(...)`
- `createPrescriptionRequestNotification(...)`
- `listPatientNotifications(...)`
- `markPatientNotificationRead(...)`
- `markAllPatientNotificationsRead(...)`
- `normalizePatientNotificationStatusFilter(...)`

Esto satisface el requisito de:

- crear notificación
- listar notificaciones de un paciente
- marcar una como leída
- marcar todas como leídas

### API actual

Endpoints existentes:

- `GET /api/patient/notifications`
- `PATCH /api/patient/notifications/[notificationId]`
- `POST /api/patient/notifications/read-all`

Todos validan sesión con `requireAuthenticatedPatient()` y corren en `runtime = "nodejs"`, que es consistente con el patrón actual del proyecto.

### Integraciones que ya emiten eventos

Implementado hoy:

- `prescription_request_created`
- `prescription_file_uploaded`
- `prescription_request_accepted`
- `prescription_request_rejected`

Fuentes reales:

- `app/api/patient/requests/route.ts`
- `app/api/doctor/requests/[requestId]/files/route.ts`

Esto significa que la feature ya está viva para el flujo de recetas, aunque todavía no para todas las categorías del sistema general.

## Diferencias relevantes contra el spec original

### Nombre de tabla

El spec propone `notifications`. En MedFlow debe mantenerse `patient_notifications`.

Razón:

- evita ambigüedad
- refleja el alcance real del feature actual
- coincide con UI, types y API ya implementadas

### Nombre de clave primaria

El spec usa `id`. El sistema actual usa `patient_notification_id`.

Recomendación:

- no renombrar

Razón:

- el repo ya sigue esta convención en múltiples tablas: `patient_id`, `prescription_request_id`, `patient_medication_id`

### Ordenamiento

El spec pide ordenar por fecha descendente y priorizar unread primero si tiene sentido.

Estado actual:

- `listPatientNotifications(...)` ordena por `created_at desc`
- el conteo de unread se devuelve aparte

Ajuste recomendado:

- cambiar el query a orden lógico por `status asc, created_at desc` solo si la UI realmente necesita unread-first en el feed principal

Decisión pragmática:

- para el backend inicial no es bloqueante
- el comportamiento actual ya cumple la parte más importante: historial descendente y operaciones de lectura

### Metadata JSON

El spec pide metadata opcional en JSON/JSONB.

Estado actual:

- `metadata jsonb not null default '{}'::jsonb`
- check para asegurar que sea objeto JSON

Esto ya está correctamente resuelto.

## Qué falta para que el sistema sea realmente “general”

La base ya existe, pero hoy solo está integrada en el flujo de recetas. Para que responda a la definición completa de `Notificacion2.md`, faltan estas integraciones:

### 1. Calendario semanal

Objetivo:

- empezar a persistir notificaciones `category = calendar`

Fuentes existentes para integrarlo:

- `weekly_schedule_configs`
- `weekly_schedule_logs`
- `app/api/patient/calendar/route.ts`
- `app/api/patient/calendar/logs/route.ts`
- `lib/calendar/*`

Plan recomendado:

- no crear tablas nuevas
- agregar helpers específicos en `lib/patient/notifications.ts` para calendario
- usar `weekly_schedule_config_id` y `metadata` para guardar contexto

Eventos iniciales recomendados:

- `calendar_dose_reminder`
- `calendar_missed_dose`

Nota:

- no hace falta push/email/WhatsApp
- la persistencia puede originarse más adelante desde cron, Edge Function o proceso server-side

### 2. Observaciones del médico

Objetivo:

- soportar `category = doctor_message`

Estado actual:

- no hay todavía una tabla dedicada de observaciones/mensajes clínicos

Plan recomendado:

- no crear una tabla nueva en esta fase, salvo que el producto necesite historial editable o conversación
- cuando exista la acción del médico, emitir una `doctor_observation_created` en `patient_notifications`
- guardar contexto mínimo en `metadata`

Campos de metadata sugeridos:

- `doctor_note_id` futuro
- `active_doctor_id`
- `patient_medication_id` opcional

### 3. Recordatorios del sistema

Objetivo:

- soportar `category = system`

Casos razonables con el dominio actual:

- `medication_running_low`
- `follow_up_reminder`

Fuentes ya disponibles:

- `lib/patient/medication-calculations.ts`
- `patient_medications.next_consultation_at`
- estado de pedidos abiertos en `prescription_requests`

Plan recomendado:

- reutilizar `patient_notifications`
- calcular el evento desde datos existentes
- persistir la notificación, no recalcularla en cada render de UI

## Cambios de schema recomendados ahora

No hace falta agregar ni modificar tablas para cumplir la base inicial del sistema general.

La tabla actual ya soporta:

- persistencia
- lectura
- actualización de estado
- metadata libre
- relaciones con el dominio actual

Como mejora opcional futura, no obligatoria para esta entrega:

- agregar políticas RLS explícitas para `patient_notifications`

Motivo:

- Supabase marca la tabla con `RLS enabled, no policy`
- hoy la app usa `createAdminSupabaseClient()` en el backend, por lo que no está bloqueada funcionalmente
- si en algún momento se quisiera exponer lectura directa con clientes menos privilegiados, convendría cerrar eso correctamente

## Plan de implementación adaptado al repo

### Fase 1. Consolidar el backend ya existente

- Tomar `patient_notifications` como tabla oficial del centro de notificaciones del paciente.
- Tomar `lib/patient/notifications.ts` como repositorio central.
- Mantener los endpoints actuales como boundary backend oficial para UI.

### Fase 2. Normalizar el contrato del sistema general

- Documentar `patient_notifications` como reemplazo práctico del concepto genérico `notifications`.
- Mantener `category`, `source`, `status` y `priority` con `CHECK constraints`.
- Mantener `type` extensible en TypeScript.

### Fase 3. Extender emisión de eventos

- Calendario:
  - agregar helper `createCalendarNotification(...)`
  - persistir recordatorios y eventos de omisión
- Doctor message:
  - emitir `doctor_observation_created` cuando exista el flujo correspondiente
- System:
  - emitir `medication_running_low` y `follow_up_reminder` desde lógica del dominio actual

### Fase 4. Refinamientos backend

- evaluar ordenar unread primero en `listPatientNotifications(...)`
- definir estrategia de deduplicación por `dedupe_key` para recordatorios recurrentes
- agregar tests de integración para repo y route handlers

## Decisión final

La adaptación correcta de `Notificacion2.md` al estado actual de MedFlow es:

- no crear una nueva tabla `notifications`
- no rehacer el backend
- adoptar `patient_notifications` como implementación base oficial
- reconocer que el backend inicial ya está implementado para recetas
- extender esa misma infraestructura a calendario, observaciones del médico y recordatorios del sistema

## Archivos relevantes del estado actual

- `supabase/migrations/20260328234500_patient_notifications_mvp.sql`
- `lib/patient/notifications.ts`
- `lib/patient/types.ts`
- `services/patient/patient-service.ts`
- `app/api/patient/notifications/route.ts`
- `app/api/patient/notifications/[notificationId]/route.ts`
- `app/api/patient/notifications/read-all/route.ts`
- `app/api/patient/requests/route.ts`
- `app/api/doctor/requests/[requestId]/files/route.ts`
