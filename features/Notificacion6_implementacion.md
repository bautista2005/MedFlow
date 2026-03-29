# Notificacion6 - Implementacion adaptada a MedFlow

## Resumen ejecutivo

La capacidad pedida en `features/Notificacion6.md` ya esta parcialmente preparada en MedFlow:

- existe una tabla unificada `public.patient_notifications`
- el schema ya acepta `category = 'doctor_message'`
- los tipos de frontend/backend ya incluyen `doctor_observation_created`
- el feed de notificaciones del paciente ya renderiza la categoria `doctor_message`
- ya existe una via backend real que crea esta notificacion cuando el medico guarda una observacion en un pedido:
  `app/api/doctor/requests/[requestId]/note/route.ts`

La brecha real no es crear un sistema nuevo, sino consolidar el contrato para que quede listo para futuras observaciones y mensajes manuales sin rediseño posterior.

La decision correcta para este repo es:

- mantener `public.patient_notifications` como unica tabla de feed general
- seguir usando `lib/patient/notifications.ts` como punto central de emision
- estandarizar metadata de notificaciones medicas para que soporte observaciones ligadas a pedido, tratamiento o mensaje libre
- evitar crear todavia una tabla de mensajeria separada

## Analisis del codebase

## Estructura general

MedFlow es una app Next.js App Router ya organizada por dominios:

- `app/(public)/*`
  pantallas de landing, login, registro medico y exito
- `app/(doctor)/*`
  shell autenticado del medico y panel `/panel`
- `app/(patient)/*`
  shell autenticado del paciente y dashboard `/paciente`
- `app/api/*`
  boundary backend en route handlers `runtime = "nodejs"`
- `services/*`
  capa cliente para invocar APIs autenticadas
- `lib/*`
  tipos, helpers de dominio, auth server-side y clientes Supabase
- `supabase/migrations/*`
  fuente de verdad del schema

## Flujo de datos actual

El patron actual es consistente:

1. componente cliente llama a `services/*`
2. `services/*` resuelve el access token de Supabase
3. route handler en `app/api/*` valida sesion con `requireAuthenticatedDoctor()` o `requireAuthenticatedPatient()`
4. el handler usa `createAdminSupabaseClient()` para leer/escribir en Postgres o Storage
5. los tipos compartidos viven en `lib/doctor/types.ts`, `lib/patient/types.ts` y `lib/calendar/types.ts`

Para notificaciones del paciente, la cadena actual ya existe:

- listado API: `app/api/patient/notifications/route.ts`
- marcar una como leida: `app/api/patient/notifications/[notificationId]/route.ts`
- marcar todas: `app/api/patient/notifications/read-all/route.ts`
- servicio cliente: `services/patient/patient-service.ts`
- logica central: `lib/patient/notifications.ts`
- UI: `components/mediya/patient/patient-notification-center.tsx`
- item visual: `components/mediya/patient/patient-notification-item.tsx`
- pantalla dedicada: `app/(patient)/paciente/notificaciones/page.tsx`

## Hallazgo clave

La observacion medica ya esta integrada parcialmente en producto:

- el medico puede guardar `doctor_note` en un pedido desde `components/mediya/doctor/requests-panel.tsx`
- eso llama a `services/doctor/doctor-service.ts`
- el backend persiste la observacion en `app/api/doctor/requests/[requestId]/note/route.ts`
- si la observacion cambia, el handler ejecuta `createDoctorObservationNotification()`

Entonces, en esta iteracion, la mayor parte del objetivo ya esta funcionando.

## Analisis de base de datos

## Tablas relevantes

### `public.active_doctors`

Define al medico autenticado real del sistema.
Clave principal:

- `active_doctor_id`

### `public.patients`

Define al paciente autenticado.
Clave principal:

- `patient_id`

### `public.patient_medications`

Representa tratamientos/medicaciones asignadas por medico a paciente.
Sirve como ancla natural para futuras observaciones ligadas a tratamiento.

### `public.prescription_requests`

Representa pedidos de receta del paciente.
Ya contiene `doctor_note`, por eso hoy la observacion medica nace naturalmente desde este flujo.

### `public.patient_notifications`

Es la tabla central del feed general del paciente. La migracion
`supabase/migrations/20260328234500_patient_notifications_mvp.sql`
ya define:

- FK a `patients`
- FK opcional a `active_doctors`
- FK opcional a `patient_medications`
- FK opcional a `prescription_requests`
- FK opcional a `weekly_schedule_configs`
- `source`
- `category`
- `type`
- `title`
- `message`
- `metadata jsonb`
- `dedupe_key`

Checks relevantes ya existentes:

- `source in ('system', 'doctor', 'pharmacy', 'calendar')`
- `category in ('calendar', 'prescription', 'doctor_message', 'system')`
- metadata debe ser un objeto JSON

## Compatibilidad con el feature pedido

El requerimiento dice:

- soportar `category = doctor_message` o `doctor_observation`
- crear estas notificaciones desde backend
- guardar metadata con `doctor_id`, `patient_id`, `related_prescription_id`
- mostrarlo en UI consistente
- dejarlo extensible

Comparado contra el estado actual:

- `doctor_message`: ya soportado
- `doctor_observation` como categoria: no existe y no conviene agregarla
- creacion desde backend: ya soportada
- metadata pedida: parcialmente soportada, pero no normalizada
- UI consistente: ya soportada
- extensibilidad: casi lista, falta cerrar el contrato

## Decision de diseño

No conviene introducir una nueva categoria `doctor_observation`.

Motivo:

- en este repo la categoria agrupa dominios amplios del feed
- `doctor_message` ya es el bucket correcto para observaciones, avisos clinicos y mensajes manuales del medico
- el detalle fino debe vivir en `type`, no en `category`

Por lo tanto:

- `category = 'doctor_message'`
- `type = 'doctor_observation_created'` para esta iteracion
- futuros tipos posibles:
  - `doctor_treatment_observation_created`
  - `doctor_prescription_observation_created`
  - `doctor_manual_message_created`

## Adaptacion del feature al sistema actual

## Lo que ya existe y se puede reutilizar

### Backend

`lib/patient/notifications.ts` ya tiene:

- `createPatientNotification()`
- `createPrescriptionRequestNotification()`
- `createCalendarNotification()`
- `createSystemNotification()`
- `createDoctorObservationNotification()`

Eso confirma que el archivo correcto para centralizar nuevos eventos medicos es ese, no un servicio nuevo.

### UI

`components/mediya/patient/patient-notification-item.tsx` ya maneja:

- badge por categoria
- estilo visual para `doctor_message`
- boton de accion
- estado leida/no leida

No hace falta rediseño. Solo conviene enriquecer el render con metadata medica cuando exista.

## Brechas reales a cerrar

### 1. Metadata medica no sigue todavia el contrato futuro pedido

Hoy `createDoctorObservationNotification()` guarda:

- `observation`
- `prescription_request_id` opcional
- `patient_medication_id` opcional
- `medication_name` opcional

Pero el feature pide dejar lista una estructura base con:

- `doctor_id`
- `patient_id`
- `related_prescription_id`

Ademas, hoy esos ids ya existen como columnas relacionales en la tabla, pero no siempre se duplican en metadata. Para extensibilidad futura conviene guardar ambas cosas:

- columnas relacionales para joins y filtros internos
- metadata estable para renderizado y futura interoperabilidad

### 2. El helper actual esta demasiado orientado a "observacion sobre receta"

El helper existente recibe:

- `patientMedicationId`
- `prescriptionRequestId`
- `medicationName`
- `observation`

Eso sirve para el caso actual, pero el contrato deberia evolucionar a un payload mas general.

### 3. La UI no diferencia todavia subtipos de mensajes medicos

Visualmente ya funciona, pero todavia no interpreta metadata clinica para mostrar contexto como:

- tratamiento relacionado
- pedido relacionado
- emisor medico

No es obligatorio para esta iteracion, pero conviene dejar prevista la lectura.

## Cambios propuestos

## 1. No crear tablas nuevas

No hace falta una nueva tabla `notifications`.
No hace falta una tabla `doctor_messages`.
No hace falta una tabla `doctor_observations`.

La tabla correcta sigue siendo `public.patient_notifications`.

## 2. Mantener categoria unica para mensajes medicos

Conservar:

- `category = 'doctor_message'`

No agregar:

- `category = 'doctor_observation'`

El subtipo debe resolverse con `type`.

## 3. Estandarizar metadata de mensajes medicos

Definir un contrato de metadata para notificaciones medicas:

```json
{
  "doctor_id": 12,
  "patient_id": 45,
  "related_prescription_id": 98,
  "related_treatment_id": 31,
  "message_kind": "observation",
  "observation": "Tu medica dejo una observacion...",
  "medication_name": "Losartan"
}
```

Notas:

- `related_prescription_id` es opcional
- `related_treatment_id` es opcional
- `message_kind` evita depender de parsing de `type` en futuras UIs
- `observation` conserva el texto original

## 4. Conservar las columnas relacionales existentes

No reemplazar estas columnas:

- `active_doctor_id`
- `patient_id`
- `patient_medication_id`
- `prescription_request_id`

Deben seguir usandose porque:

- permiten integridad referencial
- simplifican filtros futuros
- evitan depender solo de `metadata jsonb`

## 5. Generalizar el helper backend

La mejor evolucion en `lib/patient/notifications.ts` es:

- mantener `createDoctorObservationNotification()` por compatibilidad
- hacer que construya metadata estandarizada
- opcionalmente introducir una funcion mas general, por ejemplo:
  `createDoctorMessageNotification()`

Propuesta:

- `createDoctorMessageNotification()` recibe el contrato general
- `createDoctorObservationNotification()` se convierte en wrapper para el caso actual

Esto permite:

- no romper el flujo ya conectado a `app/api/doctor/requests/[requestId]/note/route.ts`
- dejar lista la API interna para futuros mensajes manuales o mensajes asociados a tratamiento

## 6. Mantener la UI y sumar lectura de metadata contextual

No hace falta rediseñar `PatientNotificationItem`.
Solo conviene dejar soporte opcional para:

- renderizar contexto de tratamiento si `metadata.related_treatment_id` existe
- renderizar contexto de receta si `metadata.related_prescription_id` existe
- mostrar texto adaptado por `type`

Esto puede ser incremental y no bloquea el backend.

## Cambios de base de datos

## Opcion recomendada: sin migracion de schema

Para este feature no hace falta una migracion estructural obligatoria.

Justificacion:

- la tabla ya soporta `doctor_message`
- ya existe FK a `active_doctors`
- ya existe FK a `prescription_requests`
- ya existe `metadata jsonb`

Por lo tanto, el soporte solicitado puede resolverse solo en capa TypeScript/backend.

## Opcion opcional de endurecimiento futuro

Si se quiere dejar mas explicito el contrato mas adelante, se podria sumar una migracion con checks JSON suaves, pero no lo recomiendo en esta iteracion.

Ejemplos de endurecimiento futuro:

- constraint para exigir `metadata.doctor_id` cuando `category = 'doctor_message'`
- constraint para exigir `metadata.patient_id`

No lo recomiendo ahora porque:

- aumenta acoplamiento sobre JSON
- todavia no existe el abanico completo de casos de mensajes medicos
- el schema ya tiene columnas relacionales fuertes para esos ids

## Backend changes

## Archivos involucrados

- `lib/patient/types.ts`
- `lib/patient/notifications.ts`
- `app/api/doctor/requests/[requestId]/note/route.ts`

## Ajustes concretos

### `lib/patient/types.ts`

Agregar o documentar un tipo de metadata para mensajes medicos:

- `DoctorMessageNotificationMetadata`

Campos:

- `doctor_id: number`
- `patient_id: number`
- `related_prescription_id?: number`
- `related_treatment_id?: number`
- `message_kind: "observation"`
- `observation: string`
- `medication_name?: string`

No hace falta cambiar `PatientNotificationSummary.metadata` a un union complejo si eso complica el repo. Puede mantenerse `Record<string, unknown>` y agregar helpers de parseo.

### `lib/patient/notifications.ts`

Actualizar `createDoctorObservationNotification()` para que persista metadata con este shape minimo:

- `doctor_id`
- `patient_id`
- `related_prescription_id` opcional
- `related_treatment_id` opcional
- `message_kind: "observation"`
- `observation`
- `medication_name` opcional

Seguir escribiendo tambien:

- `active_doctor_id`
- `patient_id`
- `patient_medication_id`
- `prescription_request_id`

como columnas de la tabla.

Si se generaliza:

- crear `createDoctorMessageNotification()`
- dejar `createDoctorObservationNotification()` como wrapper

### `app/api/doctor/requests/[requestId]/note/route.ts`

El handler actual ya es la via backend pedida. Solo debe seguir enviando los datos necesarios al helper nuevo/ajustado.

No hace falta crear un nuevo endpoint en esta iteracion porque:

- el feature pide dejar la capacidad preparada
- ya existe una fuente backend legitima para generarla

## Frontend changes

## Archivos involucrados

- `components/mediya/patient/patient-notification-item.tsx`
- `components/mediya/patient/patient-notification-center.tsx`
- `components/mediya/patient/patient-notifications-panel.tsx`

## Ajustes concretos

### `patient-notification-item.tsx`

Mantener el diseño actual y sumar helpers opcionales para doctor messages:

- leer `message_kind`
- leer `related_prescription_id`
- leer `related_treatment_id`
- mostrar una linea secundaria si hay contexto clinico disponible

Ejemplos:

- `Relacionada con pedido #123`
- `Relacionada con tratamiento de Losartan`

Esto debe ser optativo. Si la metadata no esta, el item debe renderizar igual que hoy.

### `patient-notifications-panel.tsx`

No requiere cambios estructurales.
El feed ya mezcla categorias y ya tiene copy que menciona observaciones clinicas.

## Edge cases y validaciones

## Validaciones backend

- no crear notificacion si `observation` queda vacia tras trim
- seguir limitando largo de observacion a 600 caracteres en el endpoint del medico
- no crear notificacion si el pedido no pertenece al medico autenticado
- evitar duplicado cuando la observacion no cambio

## Dedupe

Hoy el dedupe usa:

- `doctor_observation_created:${prescriptionRequestId}:${normalizedObservation}`

Eso esta razonablemente bien para observaciones sobre receta.
Para futura generalizacion conviene evolucionar a algo como:

- con receta: `doctor_observation_created:prescription:${id}:${hash-or-text}`
- con tratamiento: `doctor_observation_created:treatment:${id}:${hash-or-text}`
- mensaje libre: sin `dedupe_key` o con una key generada por origen

No hace falta cambiarlo ya si esta iteracion es solo preparatoria.

## Compatibilidad futura

Con la propuesta anterior queda preparado el camino para:

- observaciones ligadas a tratamiento
- observaciones ligadas a receta
- mensajes manuales del medico

sin cambiar la tabla principal ni rehacer la UI.

## Plan de ejecucion paso a paso

1. Revisar y documentar el contrato actual de `doctor_message` en `lib/patient/notifications.ts`.
2. Estandarizar metadata medica para incluir `doctor_id`, `patient_id` y `related_prescription_id` opcional.
3. Agregar `related_treatment_id` opcional para cubrir la evolucion a observaciones ligadas a tratamiento.
4. Mantener `createDoctorObservationNotification()` como wrapper compatible.
5. Opcionalmente introducir `createDoctorMessageNotification()` como helper interno general.
6. Verificar que `app/api/doctor/requests/[requestId]/note/route.ts` siga siendo la via backend actual de emision.
7. Ajustar `patient-notification-item.tsx` para leer metadata contextual sin depender de que siempre exista.
8. Probar flujo completo:
   - medico guarda observacion
   - se actualiza `prescription_requests.doctor_note`
   - se inserta fila en `patient_notifications`
   - paciente ve item en `/paciente/notificaciones`
9. Confirmar que marcar como leida y filtros `all/unread/read` sigan funcionando sin cambios.

## Conclusion

La implementacion correcta para Notificacion6 no requiere crear un sistema nuevo.
MedFlow ya tiene la base adecuada y hasta un flujo backend real de observaciones medicas.

La adaptacion correcta es minima y precisa:

- conservar `patient_notifications`
- consolidar `doctor_message` como categoria unica
- usar `doctor_observation_created` como tipo actual
- normalizar metadata para incluir `doctor_id`, `patient_id` y referencias opcionales
- dejar el helper backend listo para futuros mensajes medicos sin rediseño

Eso deja la feature preparada para evolucionar a mensajeria clinica ligera sin romper la arquitectura actual.
