# Implementacion de Notificacion3 en MedFlow

## 1. Resumen ejecutivo

La base de esta funcionalidad ya existe en el proyecto. MedFlow ya tiene:

- una tabla unificada `public.patient_notifications`
- tipos compartidos en `lib/patient/types.ts`
- helpers de negocio en `lib/patient/notifications.ts`
- endpoints para listar y marcar como leidas las notificaciones
- componentes UI para mostrar un feed de notificaciones en el panel del paciente

Por lo tanto, `Notificacion3` no debe implementarse como un sistema nuevo. La adaptacion correcta es consolidar y completar el MVP existente para que quede formalmente como la seccion general de “Notificaciones” del paciente.

La fuente de datos unificada debe seguir siendo `patient_notifications`.

## 2. Estado actual del sistema

### Frontend actual

- La vista del paciente vive en `app/(patient)/paciente/page.tsx`.
- El dashboard principal ya renderiza `PatientNotificationCenter` dentro de `components/mediya/patient/patient-dashboard.tsx`.
- Cada item se representa con `PatientNotificationItem`.
- La UI ya muestra:
  - titulo
  - mensaje
  - fecha/hora
  - categoria visual
  - estado leida/no leida
  - accion para marcar una como leida
  - accion para marcar todas como leidas
  - `action_url`
  - empty state

### Backend actual

- `GET /api/patient/notifications` lista notificaciones del paciente autenticado.
- `PATCH /api/patient/notifications/[notificationId]` marca una notificacion como leida.
- `POST /api/patient/notifications/read-all` marca todas como leidas.
- `services/patient/patient-service.ts` ya abstrae estas llamadas para cliente.

### Generacion actual de notificaciones

Ya se generan notificaciones desde distintos flujos:

- Recetas:
  - cuando el paciente crea un pedido
  - cuando el medico sube la receta
  - cuando el pedido queda aceptado o rechazado
- Calendario:
  - cuando el paciente registra una toma omitida
- Sistema:
  - cuando una medicacion podria requerir reposicion
  - cuando una consulta de seguimiento esta cercana

### Base de datos actual

La migracion `supabase/migrations/20260328234500_patient_notifications_mvp.sql` ya crea la tabla `patient_notifications` con:

- relaciones a paciente, medico, tratamiento, pedido y calendario semanal
- `source`, `category`, `type`
- `title`, `message`
- `status` (`unread` / `read`)
- `priority`
- `action_url`
- `metadata`
- `scheduled_for`
- `read_at`
- `dedupe_key`

Tambien existen indices por paciente, estado, categoria y claves de relacion, por lo que el diseño base es consistente con la funcionalidad pedida.

## 3. Lectura del requerimiento y adaptacion realista

El feature pide una seccion general de “Notificaciones” que unifique:

- recordatorios del calendario semanal
- estado de recetas
- futuras observaciones del medico
- alertas generales del sistema

En el estado actual, MedFlow ya cubre 3 de esos 4 grupos:

- calendario: cubierto parcialmente
- receta: cubierto
- sistema: cubierto
- observaciones del medico: tipado previsto, pero todavia no existe flujo funcional visible en la app

La implementacion recomendada no es rediseñar el backend, sino cerrar la funcionalidad sobre esta base:

1. formalizar una pantalla o seccion dedicada de notificaciones para paciente
2. reutilizar el feed existente como componente principal
3. completar los eventos faltantes, especialmente observaciones del medico
4. ajustar naming y layout para que la funcionalidad quede preparada para crecimiento futuro

## 4. Gaps detectados frente a Notificacion3

### Ya resuelto

- lista ordenada de mas nueva a mas vieja
- titulo, mensaje, fecha/hora
- estado leida/no leida
- categorias visuales
- destacado de no leidas
- marcar una como leida
- marcar todas como leidas
- navegacion por `action_url`
- empty state
- responsive web
- contador de no leidas en respuesta backend (`unread_count`)

### Pendiente o incompleto

- la funcionalidad sigue embebida dentro del dashboard, no esta formalizada como pantalla/seccion dedicada
- no existe hoy un flujo real de “observacion del medico” que escriba en `patient_notifications`
- los eventos de calendario estan incompletos para el caso “Tomá tu medicación”
  - hoy existe `calendar_missed_dose`
  - existe helper para `calendar_dose_reminder`, pero no se ve un disparador real en el sistema
- no hay filtro visual en la UI por estado o categoria
  - no es obligatorio para el feature, pero puede mejorar la usabilidad cuando crezca el feed
- el naming actual del componente (`PatientNotificationCenter`) ya sirve, pero el requerimiento menciona `NotificationsPanel` como referencia; conviene decidir si se renombra o se mantiene el naming actual

## 5. Arquitectura propuesta

### Fuente de verdad

Mantener `public.patient_notifications` como unica fuente de datos para todas las notificaciones del paciente.

No crear tablas separadas por modulo.

### Capa backend

Seguir el patron ya existente:

- route handlers en `app/api/patient/*`
- validacion de sesion con `requireAuthenticatedPatient()`
- logica reusable en `lib/patient/notifications.ts`
- cliente browser consumiendo `services/patient/patient-service.ts`

### Capa frontend

Seguir el patron actual:

- componentes de paciente en `components/mediya/patient/*`
- fetch desde `services/patient/patient-service.ts`
- vista renderizada dentro del shell del paciente

### Alcance recomendado

Implementar Notificacion3 en dos niveles:

1. consolidacion MVP
   - dejar una pantalla/seccion oficial de notificaciones
   - reutilizar y pulir lo existente

2. cierre funcional
   - habilitar emision de notificaciones faltantes
   - especialmente doctor observations y recordatorios reales de calendario

## 6. Cambios de backend

### 6.1. Mantener endpoints actuales

No hace falta reemplazar los endpoints ya creados:

- `GET /api/patient/notifications`
- `PATCH /api/patient/notifications/[notificationId]`
- `POST /api/patient/notifications/read-all`

Estos ya cubren el feed principal y las acciones pedidas por el feature.

### 6.2. Extender `lib/patient/notifications.ts`

Agregar un helper explicito para observaciones del medico, reutilizando `createPatientNotification()`. Ejemplo de responsabilidad:

- categoria: `doctor_message`
- source: `doctor`
- type: `doctor_observation_created`
- `action_url`: idealmente al detalle del tratamiento o a la pantalla de notificaciones

Esto encaja con los tipos ya existentes y no requiere duplicar logica.

### 6.3. Conectar notificaciones de observacion medica al flujo real

Hoy no se ve un endpoint o servicio que permita al medico dejar observaciones persistidas para el paciente. Hay dos caminos:

- Camino minimo para este feature:
  - permitir emitir una notificacion de observacion sin crear un modulo nuevo complejo
  - registrar el texto de observacion en `metadata`
- Camino mas robusto:
  - crear una entidad persistente de observaciones y, al crearla, emitir tambien la notificacion

Recomendacion pragmatica:

- Para cumplir Notificacion3 con cambios minimos, usar primero el camino minimo si el producto solo necesita el feed.
- Si la observacion debe tener historial editable, trazabilidad o pantalla propia, entonces conviene crear entidad nueva.

### 6.4. Completar recordatorios de calendario

El helper `createCalendarNotification()` ya soporta `calendar_dose_reminder`, pero no se observa un disparador real.

Plan recomendado:

- no generar recordatorios en cada render del dashboard
- dispararlos desde un proceso controlado

Opciones:

- opcion simple de corto plazo:
  - generar eventos al abrir la semana actual si faltan notificaciones futuras para el dia
  - requiere mucho cuidado con duplicados
- opcion correcta:
  - crear un job programado o edge function que emita recordatorios por `weekly_schedule_configs`

Dado el estado del repo, la opcion correcta es mejor para evitar side effects en requests de lectura.

### 6.5. Evitar efectos secundarios indeseados en endpoints de lectura

Hoy `GET /api/patient/dashboard` dispara `createSystemNotification()` para algunas alertas de sistema.

Eso funciona por `dedupe_key`, pero mezcla lectura con escritura. Para esta funcionalidad conviene dejar asentado que, a futuro, la emision de notificaciones deberia migrarse a flujos mas explicitos:

- acciones de negocio
- jobs programados
- hooks backend dedicados

No es obligatorio cambiarlo en esta iteracion si se quiere minimizar riesgo.

## 7. Cambios de frontend

### 7.1. Formalizar la pantalla/seccion de notificaciones

Crear una vista dedicada bajo el arbol del paciente. La recomendacion es:

- nueva ruta: `app/(patient)/paciente/notificaciones/page.tsx`

Ventajas:

- cumple literalmente el requerimiento de “seccion o pantalla”
- evita que el feed quede solo como bloque secundario del dashboard
- facilita agregar contador, filtros y paginacion mas adelante

### 7.2. Reutilizar los componentes actuales

Reutilizar en lugar de rehacer:

- `PatientNotificationCenter` como contenedor principal
- `PatientNotificationItem` como tarjeta reutilizable

Posibles ajustes:

- permitir modo “full page” y modo “dashboard”
- desacoplar el titulo visual para que el mismo componente funcione tanto embebido como en pantalla dedicada

### 7.3. Integrar navegacion desde la shell del paciente

Agregar acceso visible a “Notificaciones” dentro del flujo del paciente. Dependiendo del diseño actual puede resolverse con:

- un link en header/topbar
- un CTA desde el dashboard
- ambos

La opcion recomendada es ambos:

- CTA resumido en dashboard
- pantalla dedicada para ver historial completo

### 7.4. Mantener comportamiento responsive actual

La base visual existente ya es consistente con el sistema:

- tarjetas redondeadas
- gradientes suaves
- badges por categoria
- botones con primitives existentes

Se debe conservar esa direccion visual y no introducir otro sistema de estilos.

### 7.5. Preparacion para contador de no leidas

La API ya devuelve `unread_count`, por lo que la UI puede quedar lista para:

- badge en topbar
- badge en link lateral o cabecera
- resumen en dashboard

No hace falta cambiar esquema para esto.

## 8. Cambios de base de datos

## 8.1. Cambios obligatorios

No hay cambios obligatorios de schema para cumplir la mayor parte de Notificacion3.

La tabla `patient_notifications` ya soporta:

- categorias requeridas
- estado leida/no leida
- action URL
- metadata flexible
- prioridad
- ordenamiento temporal

## 8.2. Cambios opcionales recomendados

Solo si se quiere soportar observaciones medicas como entidad propia y no solo como notificacion:

- nueva tabla `patient_doctor_observations`

Columnas sugeridas:

- `patient_doctor_observation_id`
- `patient_id`
- `active_doctor_id`
- `patient_medication_id` nullable
- `title`
- `message`
- `created_at`
- `updated_at`

Justificacion:

- desacopla el contenido medico persistente del feed efimero de notificaciones
- permite historial, auditoria y futura UI de detalle

Si el alcance actual es solo mostrar observaciones dentro del feed, esta tabla puede postergarse.

## 9. Validaciones y edge cases

### Seguridad y ownership

- el paciente solo debe listar y marcar sus propias notificaciones
- los endpoints actuales ya filtran por `patient_id`
- cualquier nueva emision debe usar ids del paciente/medico validados desde backend

### Duplicados

- mantener uso de `dedupe_key` para eventos repetibles
- especialmente importante para:
  - recordatorios de calendario
  - alertas de medicacion proxima a agotarse
  - seguimiento cercano

### Action URLs

- las `action_url` deben ser rutas internas validas de la app
- evitar guardar URLs externas arbitrarias si no hay caso de negocio

### Consistencia de lectura

- si una notificacion ya esta en `read`, volver a marcarla no debe romper nada
- la accion de “marcar todas” debe ignorar silenciosamente las ya leidas

### Empty state

- conservar empty state elegante en pantalla dedicada y dashboard
- el texto debe contemplar que puede haber notificaciones de multiples modulos

### Escalabilidad

Si el volumen crece, los siguientes ajustes pueden ser necesarios:

- paginacion
- filtros por categoria
- filtros por estado
- limite por fecha

No son necesarios para esta iteracion.

## 10. Plan de ejecucion paso a paso

### Fase 1. Consolidar la experiencia

1. Crear la ruta `app/(patient)/paciente/notificaciones/page.tsx`.
2. Reutilizar la logica de fetch y acciones ya existente en `services/patient/patient-service.ts`.
3. Extraer la logica de carga/mutacion de notificaciones desde `PatientDashboard` a un componente o hook reutilizable, para evitar duplicacion entre dashboard y pantalla dedicada.
4. Dejar el dashboard con un resumen y CTA hacia la pantalla completa, o mantener el feed reducido y agregar acceso al historial completo.

### Fase 2. Completar fuentes faltantes

5. Agregar helper `createDoctorObservationNotification()` en `lib/patient/notifications.ts`.
6. Conectar ese helper al flujo real donde el medico deje observaciones.
7. Definir el mecanismo de emision para `calendar_dose_reminder` sin acoplarlo a endpoints de lectura.

### Fase 3. Pulido funcional

8. Revisar textos por categoria para que sean consistentes con el tono del producto.
9. Verificar estados de carga y errores en la pantalla de notificaciones.
10. Validar navegacion por `action_url` para receta, calendario y futuras observaciones.
11. Dejar preparado un punto de extension para badge global de `unread_count`.

## 11. Orden recomendado de implementacion

### Prioridad alta

- pantalla dedicada de notificaciones
- reutilizacion de feed actual
- acceso visible desde experiencia paciente

### Prioridad media

- observaciones del medico conectadas a notificaciones
- recordatorios reales de calendario

### Prioridad baja

- filtros por categoria/estado
- paginacion
- persistencia separada de observaciones medicas

## 12. Conclusion

La implementacion correcta de Notificacion3 en este repo es evolutiva, no fundacional.

MedFlow ya tiene la mayor parte del backend, schema y UI base para un centro unificado de notificaciones del paciente. El trabajo real pendiente consiste en:

- convertir el MVP actual en una seccion/pantalla oficial
- reutilizar la misma fuente de datos `patient_notifications`
- completar las fuentes de eventos faltantes
- evitar crear subsistemas paralelos

Con este enfoque se mantiene compatibilidad con la arquitectura actual, se minimiza riesgo sobre funcionalidades existentes y se deja el sistema listo para sumar contador global de no leidas mas adelante.
