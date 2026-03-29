# Implementación de Notificacion7

## Objetivo

Agregar un resumen de notificaciones en la home del paciente y un badge de no leídas reutilizando el sistema existente de `patient_notifications`, sin crear un modelo paralelo ni duplicar lógica.

## Estado actual relevado

El código ya tiene una base sólida para esta feature:

- Existe el modelo `public.patient_notifications` en `supabase/migrations/20260328234500_patient_notifications_mvp.sql`.
- Ya existen utilidades backend para crear, listar y marcar notificaciones en [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts).
- Ya existe el endpoint [`app/api/patient/notifications/route.ts`](/home/bachu/MedFlow/app/api/patient/notifications/route.ts) que devuelve `notifications` y `unread_count`.
- Ya existe una pantalla completa en [`app/(patient)/paciente/notificaciones/page.tsx`](/home/bachu/MedFlow/app/(patient)/paciente/notificaciones/page.tsx).
- Ya existe un panel reusable en [`components/mediya/patient/patient-notifications-panel.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notifications-panel.tsx).
- Ya existe el badge visual en la navegación del paciente en [`components/mediya/patient/patient-topbar-nav.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-topbar-nav.tsx).

La necesidad real no es crear el sistema, sino adaptarlo para que:

- el resumen en home muestre exactamente las 3 más recientes;
- el badge no dependa de descargar el feed completo;
- la UI de home y la UI de centro completo compartan la misma fuente de datos y los mismos componentes;
- la experiencia quede más alineada con el requerimiento de “preview resumido”.

## Diagnóstico

### Qué ya cumple

- Contador de no leídas: ya existe en la respuesta de `listPatientNotifications`.
- Badge visual en “Notificaciones”: ya existe.
- Pantalla completa de notificaciones: ya existe.
- Resaltado visual de no leídas: ya existe en [`components/mediya/patient/patient-notification-item.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-item.tsx).
- Reutilización del mismo modelo de datos: ya ocurre mediante `patient_notifications`.

### Qué falta ajustar

- En dashboard se muestran 4 elementos, no 3.
- El dashboard obtiene el contador usando `listPatientNotifications("unread")`, lo que trae una lista completa cuando solo necesita conteo.
- El topbar usa `listPatientNotifications()` sin límite, lo que también descarga más datos de los necesarios para renderizar solo el badge.
- El modo dashboard del panel sigue conservando controles de filtro pensados más para el centro completo que para un resumen breve.

## Decisión de arquitectura

Mantener un único backend de notificaciones y extenderlo mínimamente.

La propuesta es:

1. Mantener `public.patient_notifications` como única fuente de verdad.
2. Reutilizar [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts) como capa de consultas.
3. Extender el endpoint de listado existente para soportar consultas resumidas mediante parámetros opcionales.
4. Hacer que la home y el badge consuman consultas livianas del mismo endpoint, sin crear una tabla, vista o sistema paralelo.
5. Mantener la pantalla `/paciente/notificaciones` sobre el mismo flujo, con modo completo.

Esto preserva el diseño actual del proyecto:

- componentes cliente consumen `services/*`;
- `app/api/*` actúa como boundary backend;
- la lógica de acceso a Supabase queda en `lib/*`;
- no se rompe el flujo existente de notificaciones.

## Cambios backend

### 1. Extender la consulta de listado de notificaciones

Archivo principal:

- [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts)

Cambios propuestos:

- Cambiar la firma de `listPatientNotifications` para aceptar opciones adicionales:
  - `status`
  - `limit?: number | null`
- Aplicar `.limit(limit)` solo cuando el valor exista y sea válido.
- Mantener el conteo de `unread_count` como query separada, porque el badge y el dashboard lo necesitan aunque el feed venga limitado.

Resultado esperado:

- `status=all` + `limit=3` devuelve preview reciente.
- `status=unread` + `limit=1` o `limit=0/omitido` permite obtener badge sin descargar todo el historial.
- El centro completo puede seguir pidiendo la lista sin límite.

### 2. Validar nuevos parámetros en el route handler

Archivo:

- [`app/api/patient/notifications/route.ts`](/home/bachu/MedFlow/app/api/patient/notifications/route.ts)

Cambios propuestos:

- Leer `limit` desde `searchParams`.
- Validar que sea entero positivo y razonable.
- Si `limit` es inválido, responder `400`.
- Pasar `limit` a `listPatientNotifications`.

Recomendación:

- Permitir `limit` entre `1` y `20`.
- No introducir `preview=true` si `limit` alcanza para cubrir el caso y mantener la API simple.

### 3. Agregar helpers explícitos en la capa de servicios del paciente

Archivo:

- [`services/patient/patient-service.ts`](/home/bachu/MedFlow/services/patient/patient-service.ts)

Cambios propuestos:

- Mantener `listPatientNotifications(status)` por compatibilidad o extender su firma a:
  - `listPatientNotifications(options?: { status?: PatientNotificationStatusFilter; limit?: number })`
- Agregar un helper pequeño y explícito para la home:
  - `getPatientNotificationPreview()`
- Agregar un helper pequeño y explícito para el badge:
  - `getPatientNotificationBadgeSummary()`

Nota:

- Ambos helpers deben seguir llamando al mismo endpoint `/api/patient/notifications`.
- No crear fetchs directos a Supabase desde componentes.

### 4. Ajustar tipos compartidos sin romper compatibilidad

Archivo:

- [`lib/patient/types.ts`](/home/bachu/MedFlow/lib/patient/types.ts)

Cambios propuestos:

- Mantener `PatientNotificationListResponse` como contrato principal.
- No hace falta un nuevo modelo persistente.
- Opcionalmente, si se quiere mejorar claridad semántica en frontend, crear un alias liviano:
  - `type PatientNotificationPreviewResponse = PatientNotificationListResponse`

No es obligatorio crear un tipo nuevo si no aporta claridad real.

## Cambios frontend

### 1. Refinar el panel reusable de notificaciones

Archivo principal:

- [`components/mediya/patient/patient-notifications-panel.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notifications-panel.tsx)

Cambios propuestos:

- En modo `dashboard`, pedir solo `limit=3`.
- En modo `page`, mantener comportamiento completo.
- Mostrar en home una variante realmente resumida:
  - sin filtros de estado;
  - con CTA claro hacia `/paciente/notificaciones`;
  - con título y copy orientados a “resumen reciente”.
- Mantener el resaltado de no leídas usando el mismo `PatientNotificationItem`.

Decisión recomendada:

- Los filtros (`Todas`, `Sin leer`, `Leídas`) deben quedar solo para `mode="page"`.
- El botón “Marcar todo como leído” puede mantenerse en página completa y omitirse en dashboard si se busca una home más limpia.

### 2. Reutilizar el mismo centro/item visual

Archivos:

- [`components/mediya/patient/patient-notification-center.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-center.tsx)
- [`components/mediya/patient/patient-notification-item.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-item.tsx)

Cambios propuestos:

- No crear un componente visual paralelo para previews si el `PatientNotificationCenter` actual puede recibir menos items y props de presentación.
- Si hace falta, agregar props de presentación livianas:
  - `showFilters?: boolean`
  - `showMarkAll?: boolean`
  - `historyLabel?: string`
  - `maxItemsLabel?` no es necesario salvo necesidad real

Objetivo:

- Reusar exactamente la misma representación visual de una notificación.
- Garantizar consistencia entre home y centro completo.

### 3. Optimizar badge en navegación

Archivo:

- [`components/mediya/patient/patient-topbar-nav.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-topbar-nav.tsx)

Cambios propuestos:

- Dejar de llamar a `listPatientNotifications()` sin límite.
- Usar helper liviano basado en el mismo endpoint para obtener:
  - `unread_count`
  - sin descargar todo el feed

Comportamiento:

- El badge debe seguir apareciendo solo en el acceso a “Notificaciones”.
- Si `unread_count === 0`, ocultar badge como hoy.

### 4. Simplificar la carga del dashboard

Archivo:

- [`components/mediya/patient/patient-dashboard.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-dashboard.tsx)

Cambios propuestos:

- Mantener el bloque “Alertas” con `unreadNotificationCount`.
- Cambiar el refresh para no pedir `listPatientNotifications("unread")` completo.
- Consumir un helper resumido para contador.
- Mantener `PatientNotificationsPanel mode="dashboard"` como bloque reusable en la home.

Resultado:

- La home carga menos datos.
- El preview y el badge siguen sincronizados con la misma tabla.

## Cambios de base de datos

## Decisión

No se requieren cambios de esquema para implementar esta feature.

Justificación:

- Ya existe `public.patient_notifications`.
- Ya existen índices útiles para este caso:
  - `(patient_id, created_at desc)`
  - `(patient_id, status, created_at desc)`
- Los requerimientos de preview y badge se cubren con consultas limitadas sobre la tabla existente.

## Cambios opcionales futuros

Solo si el volumen de notificaciones crece de forma significativa:

- evaluar un endpoint resumido dedicado en backend;
- evaluar paginación en la pantalla completa;
- evaluar cursor-based pagination si el feed deja de ser pequeño.

Para Notificacion7 no hace falta migración.

## Validaciones y edge cases

### Backend

- `limit` debe ser entero positivo.
- Si `limit` no es válido, responder `400`.
- El endpoint debe seguir devolviendo `unread_count` aunque `notifications` venga limitado.
- Si no hay notificaciones, devolver:
  - `notifications: []`
  - `unread_count: 0`

### Frontend

- Si no hay notificaciones, el bloque resumen debe mostrar empty state limpio.
- Si hay menos de 3, mostrar solo las disponibles.
- Las no leídas deben seguir con acento visual “Nueva”.
- El CTA al centro completo debe existir siempre en el resumen.
- El badge debe tolerar errores silenciosamente y caer a `0`, como ya hace el topbar.

### UX

- El dashboard no debe saturarse con controles del centro completo.
- La navegación a `/paciente/notificaciones` debe ser evidente.
- El contenido debe seguir siendo responsive en mobile y desktop.

## Plan de ejecución paso a paso

1. Extender `listPatientNotifications` en [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts) para aceptar `limit`.
2. Validar y propagar `limit` en [`app/api/patient/notifications/route.ts`](/home/bachu/MedFlow/app/api/patient/notifications/route.ts).
3. Ajustar [`services/patient/patient-service.ts`](/home/bachu/MedFlow/services/patient/patient-service.ts) para exponer helpers resumidos sobre el mismo endpoint.
4. Refactorizar [`components/mediya/patient/patient-notifications-panel.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notifications-panel.tsx):
   - `page`: lista completa con filtros
   - `dashboard`: preview de 3 items, CTA al centro completo y sin controles innecesarios
5. Actualizar [`components/mediya/patient/patient-topbar-nav.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-topbar-nav.tsx) para usar consulta liviana del badge.
6. Actualizar [`components/mediya/patient/patient-dashboard.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-dashboard.tsx) para usar consulta liviana del contador.
7. Verificar que [`components/mediya/patient/patient-notification-center.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-center.tsx) y [`components/mediya/patient/patient-notification-item.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-item.tsx) sigan sirviendo para ambos modos sin divergencias visuales.
8. Probar manualmente:
   - paciente con 0 notificaciones;
   - paciente con 1 o 2 notificaciones;
   - paciente con más de 3 notificaciones;
   - paciente con mezcla de leídas y no leídas;
   - navegación desde home al centro completo;
   - badge actualizado después de marcar una como leída y después de marcar todas.

## Riesgos y mitigación

### Riesgo 1

El badge y el preview pueden quedar desincronizados si cada componente refresca por separado.

Mitigación:

- Para esta iteración, aceptar refresh independiente porque el proyecto ya usa ese patrón.
- Si más adelante aparecen inconsistencias visibles, consolidar en un hook compartido o invalidación centralizada.

### Riesgo 2

El dashboard puede seguir mostrando demasiada UI si se reaprovecha el panel sin ajustar props.

Mitigación:

- Separar claramente el comportamiento `dashboard` de `page` dentro del componente reusable.

### Riesgo 3

Cambiar la firma de `listPatientNotifications` puede romper llamadas existentes.

Mitigación:

- Mantener defaults compatibles:
  - `status = "all"`
  - `limit` opcional

## Resultado esperado

Al terminar:

- el paciente verá en `/paciente` un bloque resumido con las 3 notificaciones más recientes;
- las no leídas seguirán destacadas;
- el acceso a “Notificaciones” seguirá mostrando badge con cantidad no leída;
- el centro completo seguirá funcionando con la misma fuente de datos;
- no habrá tablas ni lógica paralela para previews;
- la solución quedará alineada con la arquitectura actual de MedFlow.
