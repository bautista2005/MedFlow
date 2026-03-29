# Implementacion de Notificacion5 en MedFlow

## 1. Resumen ejecutivo

MedFlow ya tiene una base real para este feature:

- existe una tabla unificada `public.patient_notifications`
- ya se generan notificaciones de categoria `prescription`
- el paciente ya tiene un centro de notificaciones en `/paciente/notificaciones`
- el dashboard ya muestra un bloque de tracking de pedidos en `PatientRequestTracker`
- el flujo de recetas ya pasa por route handlers concretos en `app/api/patient/requests` y `app/api/doctor/requests/*`

Por lo tanto, la implementacion correcta de `Notificacion5` no es crear un sistema nuevo. La adaptacion correcta es conectar el flujo de recetas/pedidos al sistema general de notificaciones ya existente, y al mismo tiempo ordenar mejor el ciclo de estados de `prescription_requests`.

La fuente de verdad para las notificaciones debe seguir siendo `public.patient_notifications`, no una tabla nueva llamada `notifications`.

## 2. Analisis del sistema actual

### Arquitectura relevante

El proyecto ya esta organizado con capas claras:

- rutas App Router en `app/(patient)/*` y `app/(doctor)/*`
- route handlers backend en `app/api/*`
- servicios cliente en `services/*`
- logica de negocio compartida en `lib/*`
- esquema y contratos de datos en `supabase/migrations/*`

Para este feature, las piezas reales de integracion son:

- notificaciones:
  - `lib/patient/notifications.ts`
  - `lib/patient/types.ts`
  - `app/api/patient/notifications/*`
  - `services/patient/patient-service.ts`
  - `components/mediya/patient/patient-notifications-panel.tsx`
  - `components/mediya/patient/patient-notification-item.tsx`
- recetas/pedidos:
  - `app/api/patient/requests/route.ts`
  - `app/api/doctor/requests/route.ts`
  - `app/api/doctor/requests/[requestId]/note/route.ts`
  - `app/api/doctor/requests/[requestId]/files/route.ts`
  - `app/api/patient/dashboard/route.ts`
  - `components/mediya/patient/patient-request-tracker.tsx`

### Flujo actual de datos

Hoy el flujo real funciona asi:

1. El paciente crea un pedido en `POST /api/patient/requests`.
2. Se inserta una fila en `public.prescription_requests` con `status = 'pending'`.
3. En ese mismo momento se crea una notificacion general `prescription_request_created`.
4. El medico puede dejar una observacion en `PATCH /api/doctor/requests/[requestId]/note`.
5. Si el pedido estaba en `pending`, esa accion lo pasa a `reviewed`.
6. El medico puede subir un archivo en `POST /api/doctor/requests/[requestId]/files`.
7. Esa ruta:
   - guarda el archivo en Storage
   - inserta `prescription_files`
   - crea la notificacion `prescription_file_uploaded`
   - cambia el pedido a `accepted` o `rejected`
   - crea otra notificacion final

### Limitacion principal detectada

El flujo actual no modela el proceso pedido por `Notificacion5`. En particular:

- no existe estado explicito para “consultando farmacia”
- no existe estado explicito para “no hay stock en farmacia preferida”
- no existe estado explicito para “elegir farmacia alternativa”
- no existe estado explicito para “listo para retirar”
- el resultado actual del backend usa `Math.random()` para decidir `accepted` o `rejected`, lo cual hoy es solo un placeholder tecnico y no un flujo de negocio real

Eso significa que hoy solo una parte del requerimiento ya esta cubierta.

## 3. Analisis de base de datos

### Tablas relevantes en el esquema actual

Las migraciones y la inspeccion del proyecto muestran estas tablas publicas relevantes:

- `approved_doctors`
- `active_doctors`
- `pharmacies`
- `patients`
- `patient_doctors`
- `patient_medications`
- `prescription_requests`
- `prescription_files`
- `weekly_schedule_configs`
- `weekly_schedule_logs`
- `patient_notifications`

La instancia actual tambien reporta `RLS` habilitado para estas tablas y ya contiene datos en:

- `prescription_requests`
- `prescription_files`
- `patient_notifications`

### `public.prescription_requests`

Hoy esta tabla guarda:

- `prescription_request_id`
- `patient_id`
- `active_doctor_id`
- `patient_medication_id`
- `preferred_pharmacy_id`
- `status`
- `requested_at`
- `resolved_at`
- `patient_note`
- `doctor_note`
- snapshots de medicacion
- `created_at`
- `updated_at`

Estado permitido hoy:

- `pending`
- `reviewed`
- `accepted`
- `rejected`
- `cancelled`

Observaciones:

- la tabla ya es el lugar correcto para representar el estado del pedido
- el modelo actual es demasiado corto para expresar el flujo completo de farmacia pedido por el feature
- `preferred_pharmacy_id` guarda la farmacia preferida original, pero no distingue entre “preferida inicial” y “farmacia que finalmente esta gestionando el pedido”

### `public.prescription_files`

Ya resuelve correctamente:

- archivo adjunto de receta
- relacion con pedido, paciente y medico
- archivo actual por pedido mediante indice unico parcial

No hace falta crear otra tabla de archivos para este feature.

### `public.patient_notifications`

La migracion `20260328234500_patient_notifications_mvp.sql` ya crea una tabla que soporta exactamente el enfoque correcto:

- relacion opcional con `patient_medication_id`
- relacion opcional con `prescription_request_id`
- `source`, `category`, `type`
- `title`, `message`
- `action_url`
- `metadata jsonb`
- `dedupe_key`

Observaciones:

- ya soporta `category = 'prescription'`
- ya es suficiente para guardar el resumen de eventos pedidos
- no hace falta crear una tabla adicional de notificaciones para recetas

## 4. Estado actual frente al requerimiento de Notificacion5

### Ya resuelto

- existe un centro general de notificaciones del paciente
- ya hay categoria `prescription`
- ya se pueden guardar `prescription_request_id` y `patient_id`
- ya existe soporte para `metadata` util
- ya hay eventos reales al crear pedido y al subir receta
- el tracking del pedido ya existe como bloque del dashboard del paciente

### Parcialmente resuelto

- “Pedido enviado”: ya existe mediante `prescription_request_created`
- “Esperando respuesta del medico”: hoy se puede inferir desde `pending`, pero no se emite una notificacion separada
- “Receta cargada”: ya existe mediante `prescription_file_uploaded`

### No resuelto

- “Consultando farmacia”
- “No hay stock en farmacia preferida”
- “Elegir farmacia alternativa”
- “Confirmado para retirar / listo para retirar”
- uso de `action_url` hacia una vista de tracking mas especifica
- eliminacion del placeholder aleatorio en la resolucion del pedido

## 5. Adaptacion realista al sistema actual

La adaptacion correcta es:

1. mantener `public.prescription_requests` como fuente del estado del pedido
2. mantener `public.patient_notifications` como resumen transversal de eventos
3. centralizar la emision de notificaciones de recetas en `lib/patient/notifications.ts`
4. disparar esas notificaciones solo desde mutaciones reales del flujo, no desde endpoints de lectura
5. completar el modelo de estados del pedido para reflejar farmacia y retiro

No conviene:

- crear una tabla aparte de `notifications`
- generar notificaciones en `GET /api/patient/dashboard`
- seguir resolviendo pedidos por azar en `app/api/doctor/requests/[requestId]/files/route.ts`

## 6. Cambios de base de datos recomendados

### 6.1. Extender el estado de `prescription_requests`

Recomendacion: ampliar el `check` de `prescription_requests.status` para representar el flujo real.

Estados recomendados:

- `pending`
  significado: pedido enviado por el paciente
- `reviewed`
  significado: el medico ya tomo el pedido o dejo observacion
- `prescription_uploaded`
  significado: la receta ya fue cargada
- `pharmacy_checking`
  significado: se esta consultando stock en farmacia
- `no_stock_preferred`
  significado: la farmacia preferida no tiene stock
- `awaiting_alternative_pharmacy`
  significado: el paciente debe elegir otra farmacia
- `ready_for_pickup`
  significado: farmacia confirmo disponibilidad y retiro
- `cancelled`

Justificacion:

- estos estados cubren el feature sin crear una maquina paralela
- permiten que tracking y notificaciones hablen el mismo idioma
- hacen innecesario el uso actual de `accepted` y `rejected` para casos ambiguos

### 6.2. Agregar una farmacia operativa al pedido

Recomendacion: agregar a `prescription_requests` una columna minima:

- `assigned_pharmacy_id integer null references public.pharmacies (pharmacy_id) on delete set null`

Uso propuesto:

- al crear el pedido, si existe `preferred_pharmacy_id`, copiarla tambien a `assigned_pharmacy_id`
- si luego el paciente elige otra farmacia, actualizar `assigned_pharmacy_id`
- conservar `preferred_pharmacy_id` como snapshot de la primera preferencia

Justificacion:

- evita perder la farmacia original
- permite mostrar en tracking y notificaciones la farmacia que esta gestionando el pedido
- evita reinterpretar `preferred_pharmacy_id` con semanticas mezcladas

### 6.3. No crear tabla extra de historial en esta iteracion

No es imprescindible crear una tabla de eventos o historial para cumplir este feature.

La estrategia minima y consistente es:

- cada mutacion cambia `prescription_requests.status`
- esa misma mutacion crea una fila en `patient_notifications`

Si mas adelante el producto necesita auditoria completa o timeline medico/farmacia, ahi si conviene evaluar una tabla `prescription_request_events`.

## 7. Cambios de backend recomendados

### 7.1. Extender los tipos compartidos

Actualizar en `lib/patient/types.ts` y `lib/doctor/types.ts`:

- `PrescriptionRequestStatus`
- `PatientNotificationType`

Nuevos tipos de notificacion sugeridos:

- `prescription_request_waiting_doctor`
- `prescription_request_pharmacy_checking`
- `prescription_request_no_stock_preferred`
- `prescription_request_choose_alternative_pharmacy`
- `prescription_request_ready_for_pickup`

Mantener:

- `prescription_request_created`
- `prescription_file_uploaded`

No usar el nombre `notifications` en nuevos contratos. En este repo el concepto real es `patient_notifications`.

### 7.2. Crear un helper central para transiciones del flujo

Agregar en `lib/patient/notifications.ts` o en un modulo nuevo dedicado, por ejemplo:

- `createPrescriptionWorkflowNotification(...)`
- `transitionPrescriptionRequestStatus(...)`

Responsabilidades:

- recibir el pedido y el nuevo estado
- construir `title`, `message`, `priority`, `action_url` y `metadata`
- delegar la escritura final a `createPatientNotification(...)`
- usar `dedupe_key` para evitar duplicados por evento

Metadata recomendada:

- `prescription_request_id`
- `patient_id`
- `patient_medication_id`
- `medication_name`
- `preferred_pharmacy_id`
- `assigned_pharmacy_id`
- `pharmacy_id`
- `pharmacy_name`
- `from_status`
- `to_status`

### 7.3. Formalizar mensajes amigables para paciente

Mensajes recomendados por evento:

- `prescription_request_created`
  - titulo: `Tu pedido fue enviado`
  - mensaje: `Ya recibimos tu solicitud para {medication_name}.`
- `prescription_request_waiting_doctor`
  - titulo: `Esperando respuesta del medico`
  - mensaje: `Tu pedido esta en revision por el equipo medico.`
- `prescription_file_uploaded`
  - titulo: `Tu medica ya cargo la receta`
  - mensaje: `Ya adjuntamos la receta para {medication_name}.`
- `prescription_request_pharmacy_checking`
  - titulo: `Consultando stock en farmacia`
  - mensaje: `Estamos consultando disponibilidad en {pharmacy_name}.`
- `prescription_request_no_stock_preferred`
  - titulo: `No hay stock en tu farmacia de preferencia`
  - mensaje: `La farmacia seleccionada no tiene stock para continuar el pedido.`
- `prescription_request_choose_alternative_pharmacy`
  - titulo: `Elegi otra farmacia para continuar`
  - mensaje: `Selecciona una farmacia alternativa para seguir con tu pedido.`
- `prescription_request_ready_for_pickup`
  - titulo: `Tu medicacion esta lista para retirar`
  - mensaje: `Ya podes retirar {medication_name} en {pharmacy_name}.`

### 7.4. Ajustar el flujo de `POST /api/patient/requests`

Archivo afectado:

- `app/api/patient/requests/route.ts`

Cambios recomendados:

- seguir insertando `status = 'pending'`
- copiar `preferred_pharmacy_id` a `assigned_pharmacy_id`
- emitir dos notificaciones iniciales:
  - `prescription_request_created`
  - `prescription_request_waiting_doctor`

Justificacion:

- el feature pide que ambos hitos sean visibles
- aunque ocurran casi al mismo tiempo, representan mensajes distintos para el paciente

Para evitar ruido excesivo, una alternativa valida es:

- crear ambas notificaciones solo en la primera iteracion
- luego medir si producto quiere fusionarlas en una sola

### 7.5. Ajustar el flujo de observacion medica

Archivo afectado:

- `app/api/doctor/requests/[requestId]/note/route.ts`

Cambios recomendados:

- mantener la observacion medica como hoy
- si el estado pasa de `pending` a `reviewed`, no volver a emitir `waiting_doctor`
- opcionalmente emitir solo la notificacion de observacion medica existente

Importante:

- `reviewed` debe seguir siendo una transicion intermedia del equipo medico
- no debe confundirse con respuesta de farmacia

### 7.6. Reemplazar el placeholder aleatorio en carga de receta

Archivo afectado:

- `app/api/doctor/requests/[requestId]/files/route.ts`

Hoy esta ruta hace esto:

- sube el archivo
- crea `prescription_file_uploaded`
- decide `accepted` o `rejected` por `Math.random()`

Eso debe cambiar.

Plan recomendado:

1. al subir la receta:
   - cambiar estado a `prescription_uploaded`
   - crear `prescription_file_uploaded`
2. inmediatamente despues:
   - cambiar estado a `pharmacy_checking`
   - crear `prescription_request_pharmacy_checking`

Justificacion:

- refleja el flujo pedido
- separa el evento medico del evento farmacia
- elimina una simulacion que hoy no es compatible con el producto final

### 7.7. Agregar endpoints explicitos para decisiones de farmacia

Como el repo usa route handlers como frontera backend, la extension correcta es crear endpoints nuevos, por ejemplo:

- `PATCH /api/doctor/requests/[requestId]/pharmacy-status`
- `PATCH /api/patient/requests/[requestId]/alternative-pharmacy`

#### `PATCH /api/doctor/requests/[requestId]/pharmacy-status`

Responsabilidad:

- actualizar el pedido segun respuesta operativa de farmacia

Transiciones sugeridas:

- `pharmacy_checking` -> `no_stock_preferred`
- `no_stock_preferred` -> `awaiting_alternative_pharmacy`
- `pharmacy_checking` -> `ready_for_pickup`
- `reviewed` o `prescription_uploaded` -> `pharmacy_checking`

Cada transicion debe emitir su notificacion correspondiente.

#### `PATCH /api/patient/requests/[requestId]/alternative-pharmacy`

Responsabilidad:

- permitir al paciente elegir una farmacia alternativa
- actualizar `assigned_pharmacy_id`
- volver a mover el pedido a `pharmacy_checking`
- emitir otra notificacion de `pharmacy_checking`

Validaciones:

- el pedido debe pertenecer al paciente autenticado
- el estado actual debe ser `awaiting_alternative_pharmacy`
- la farmacia elegida debe existir y estar activa

### 7.8. Seguir el patron de automatizacion ya existente

El repo ya tiene un patron interno para notificaciones de calendario:

- logica compartida en `lib/calendar/notifications.ts`
- entrypoint interno en `app/api/internal/calendar/notifications/route.ts`

Para recetas no hace falta un job programado en esta iteracion, pero si conviene copiar el patron conceptual:

- helper central de dominio
- endpoints pequeños que solo validan, mutan y delegan

## 8. Cambios de frontend recomendados

### 8.1. Reutilizar el centro de notificaciones existente

No hace falta crear una nueva pantalla.

La UI ya tiene:

- resumen en dashboard: `PatientNotificationsPanel mode="dashboard"`
- pantalla dedicada: `/paciente/notificaciones`

El trabajo del feature es alimentar mejor ese feed.

### 8.2. Mejorar el tracking del pedido

Archivo relevante:

- `components/mediya/patient/patient-request-tracker.tsx`

Cambios recomendados:

- extender `statusLabelMap` y `statusClassNameMap` con los nuevos estados
- mostrar farmacia actual gestionando el pedido
- mostrar mejor el paso actual:
  - pedido enviado
  - revision medica
  - receta cargada
  - consulta en farmacia
  - sin stock
  - farmacia alternativa requerida
  - listo para retirar

No hace falta convertir esto en una pantalla nueva si el dashboard ya cumple como vista detallada.

### 8.3. Definir un `action_url` concreto hacia tracking

Hoy las notificaciones de receta apuntan a `/paciente`.

Eso es valido, pero se puede mejorar con un destino mas preciso.

Recomendacion pragmatica:

- agregar un ancla o seccion identificable en el tracker
- usar `action_url = '/paciente#pedidos-recientes'`

Si se prefiere no tocar scroll/anclas en esta iteracion, mantener `/paciente` sigue siendo consistente con el estado actual del producto.

### 8.4. Mantener la presentacion amigable

La UI actual ya renderiza:

- titulo
- mensaje
- fecha
- categoria
- accion `Ver detalle`

No hace falta rediseñar `PatientNotificationItem`.

Solo conviene asegurarse de que:

- `metadata` nueva no rompa tipos
- los mensajes de receta sean mas claros para paciente

## 9. Edge cases y validaciones

### Flujo y consistencia

- no crear notificaciones si el cambio de estado no ocurrio realmente
- no repetir la misma notificacion si se reintenta una mutacion
- no permitir seleccionar farmacia alternativa en estados incorrectos
- no permitir marcar “listo para retirar” sin una farmacia operativa asignada
- no permitir “consultando farmacia” si todavia no existe receta cargada, salvo que producto lo acepte explicitamente

### Datos

- si el pedido no tiene farmacia preferida, permitir `pharmacy_checking` solo cuando exista una `assigned_pharmacy_id`
- si la farmacia fue desactivada, impedir seleccionarla como alternativa
- si se reemplaza farmacia, conservar `preferred_pharmacy_id` original para contexto historico

### Notificaciones

- usar `dedupe_key` por transicion, por ejemplo:
  - `prescription_request_created:{requestId}`
  - `prescription_request_waiting_doctor:{requestId}`
  - `prescription_file_uploaded:{requestId}:{uploadedAt}`
  - `prescription_request_pharmacy_checking:{requestId}:{pharmacyId}`
  - `prescription_request_no_stock_preferred:{requestId}:{pharmacyId}`
  - `prescription_request_choose_alternative_pharmacy:{requestId}`
  - `prescription_request_ready_for_pickup:{requestId}:{pharmacyId}`
- evitar que una misma accion backend cree dos veces el mismo resumen ante retries

## 10. Plan de ejecucion paso a paso

### Fase 1. Modelo de datos

1. Crear una migracion para:
   - agregar `assigned_pharmacy_id` a `public.prescription_requests`
   - extender el `check` de `status`
2. Backfillear `assigned_pharmacy_id = preferred_pharmacy_id` para pedidos existentes donde aplique
3. Revisar si hace falta indice por `assigned_pharmacy_id`

### Fase 2. Tipos y capa de dominio

1. Actualizar `lib/patient/types.ts`
2. Actualizar `lib/doctor/types.ts`
3. Extender `lib/patient/notifications.ts` con nuevos tipos y builders de mensajes
4. Centralizar la logica de transicion y emision de notificaciones

### Fase 3. Mutaciones backend

1. Ajustar `app/api/patient/requests/route.ts`
2. Ajustar `app/api/doctor/requests/[requestId]/files/route.ts`
3. Ajustar `app/api/doctor/requests/[requestId]/note/route.ts` solo si hace falta refinar transiciones
4. Crear endpoint para respuesta de farmacia
5. Crear endpoint para eleccion de farmacia alternativa

### Fase 4. Tracking y UI

1. Extender labels y badges en `PatientRequestTracker`
2. Mantener `PatientNotificationsPanel` y `PatientNotificationItem` con cambios minimos
3. Mejorar `action_url` hacia el tracker

### Fase 5. Verificacion

Casos a probar:

- paciente crea pedido
- aparece “pedido enviado”
- aparece “esperando respuesta del medico”
- medico sube receta
- aparece “receta cargada”
- aparece “consultando farmacia”
- farmacia sin stock
- aparece “no hay stock”
- aparece “elegi otra farmacia”
- paciente selecciona otra farmacia
- vuelve a aparecer “consultando farmacia”
- farmacia confirma disponibilidad
- aparece “lista para retirar”
- el tracker refleja el mismo estado que el feed
- reintentos no duplican notificaciones

## 11. Conclusion

La implementacion recomendada para `Notificacion5` en MedFlow es incremental y compatible con el sistema actual:

- no crear un sistema nuevo de notificaciones
- reutilizar `patient_notifications`
- convertir `prescription_requests` en una maquina de estados mas expresiva
- emitir notificaciones generales desde cada transicion real
- mantener el tracking detallado del pedido como vista complementaria

El cambio mas importante no es visual sino de dominio: reemplazar la resolucion simulada actual por un flujo de estados explicito entre paciente, medico y farmacia. Una vez hecho eso, el centro de notificaciones existente ya puede funcionar como el resumen general que pide el feature.
