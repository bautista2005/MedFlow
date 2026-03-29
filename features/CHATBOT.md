# Implementacion Adaptada: Chatbot para Pacientes en MedFlow

## Objetivo
Implementar un chatbot dentro de MedFlow, visible solo para usuarios con rol `patient`, reutilizando la arquitectura actual de App Router, los servicios cliente en `services/*`, la validacion de sesion con Supabase Auth, y el sistema existente de notificaciones del paciente.

El objetivo no debe resolverse como un modulo aislado. Tiene que integrarse con:
- tratamientos activos (`patient_medications`)
- adherencia semanal (`weekly_schedule_configs`, `weekly_schedule_logs`)
- pedidos de medicacion (`prescription_requests`)
- notificaciones existentes (`patient_notifications`)
- panel medico (`/panel`, `/panel/pacientes`, `/panel/pacientes/[patientId]`)

---

## Estado Actual Relevante Del Sistema

### Frontend
- El area paciente ya esta encapsulada en [`app/(patient)/layout.tsx`](/home/bachu/MedFlow/app/(patient)/layout.tsx) y [`components/mediya/patient/patient-shell.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-shell.tsx).
- La proteccion de acceso ya existe en [`components/mediya/patient/patient-access-guard.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-access-guard.tsx).
- El dashboard del paciente carga datos agregados desde [`app/api/patient/dashboard/route.ts`](/home/bachu/MedFlow/app/api/patient/dashboard/route.ts) y se consume desde [`components/mediya/patient/patient-dashboard.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-dashboard.tsx).
- Ya existe una UI de notificaciones reutilizable en [`components/mediya/patient/patient-notifications-panel.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notifications-panel.tsx) y [`components/mediya/patient/patient-notification-item.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-notification-item.tsx).

### Backend
- Los endpoints protegidos del paciente usan `requireAuthenticatedPatient()` y bearer token.
- Los endpoints protegidos del medico usan `requireAuthenticatedDoctor()` y bearer token.
- La app sigue un patron estable:
  - `app/api/*` para route handlers
  - `services/*` para fetch cliente
  - `lib/*` para logica de dominio
  - `lib/supabase/admin.ts` para lecturas/escrituras con service role

### Base de datos
- Ya existe una tabla central de inbox del paciente: `patient_notifications`.
- Ya existe logica de adherencia semanal reutilizable en `lib/calendar/*`.
- Ya existe relacion medico-paciente mediante `patient_doctors`, con un medico primario por paciente.
- No existe hoy ningun modulo de chat ni historial conversacional.

### Hallazgos clave para adaptar el feature
- No conviene crear una tabla independiente `doctor_notifications` para mensajes al paciente. El sistema ya tiene `patient_notifications` con `category = 'doctor_message'`, `source = 'doctor'`, prioridad, metadata, estado leido/no leido y UI funcional.
- El color de riesgo del paciente para el medico tampoco debe derivarse solo del chat. Debe combinarse con adherencia y eventos recientes, porque la app ya tiene calendario semanal y pedidos.
- La generacion semanal ya tiene un precedente claro en [`app/api/internal/calendar/notifications/route.ts`](/home/bachu/MedFlow/app/api/internal/calendar/notifications/route.ts). El resumen de riesgo puede seguir ese patron interno.

---

## Decisiones De Adaptacion

### 1. Alcance del chatbot
Se implementa solo en superficie paciente.

- Visible unicamente dentro de `PatientShell`.
- No se renderiza en layout publico ni doctor.
- No se necesita una pagina dedicada inicial; el punto de entrada principal es un boton flotante global dentro del shell del paciente.

### 2. Integracion con Gemini
La integracion con Gemini debe vivir en backend, nunca desde el navegador.

- Crear un modulo dedicado en `lib/chatbot/` para:
  - armar contexto del paciente
  - construir prompt del sistema
  - llamar al proveedor LLM
  - clasificar severidad
  - aplicar disclaimer/fallback
- Exponerlo mediante un endpoint protegido del paciente, por ejemplo:
  - `POST /api/patient/chatbot/messages`
  - `GET /api/patient/chatbot/history`

### 3. Persistencia
Se necesita persistir historial conversacional medico-clinico, pero de forma minima.

- Crear `patient_chat_logs` para cada intercambio paciente -> IA.
- No almacenar una sesion compleja de chat multi-turno en la primera version.
- Cada fila puede representar:
  - mensaje del paciente
  - respuesta del asistente
  - severidad resultante
  - score de riesgo
  - contexto resumido usado por backend

### 4. Notificacion automatica a medico
Cuando la severidad sea critica:

- crear un evento de alerta persistente para que el medico lo vea en su superficie
- crear una notificacion para el paciente si corresponde

Para el medico, la app hoy no tiene una tabla general de notificaciones. Por eso conviene agregar una tabla pequena y especifica para alertas clinicas del chatbot, no una tabla genrica paralela a `patient_notifications`.

Recomendacion:
- crear `doctor_patient_alerts`
- usarla para alertas criticas y estados de revision

Esto evita mezclar:
- inbox del paciente
- workflow del medico
- alertas automaticas derivadas por IA

### 5. Mensajes manuales del medico al paciente
No crear `doctor_notifications`.

Reutilizar `patient_notifications` con nuevos tipos de `doctor_message` para mensajes de seguimiento, por ejemplo:
- `doctor_follow_up_requested`
- `doctor_chatbot_alert_acknowledged`

Esto es consistente con la implementacion actual de observaciones del medico en [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts).

---

## Arquitectura Propuesta

## Modulos Nuevos

### `lib/chatbot/types.ts`
Tipos para:
- severidad: `normal | warning | critical`
- estado semanal: `normal | warning | critical`
- payload de mensaje del paciente
- respuesta del chatbot
- score de riesgo
- resumen de contexto

### `lib/chatbot/prompt.ts`
Responsable de:
- disclaimer medico fijo
- instrucciones de tono
- limitaciones del asistente
- formato de salida estructurada esperado desde Gemini

La respuesta del modelo no debe parsearse como texto libre. Debe pedirse JSON estructurado con campos como:
- `reply`
- `severity`
- `symptom_tags`
- `advice_flags`
- `requires_medical_attention`

### `lib/chatbot/context.ts`
Carga el contexto del paciente desde Supabase usando admin client:
- perfil basico del paciente
- medico primario
- tratamientos activos
- resumen de adherencia de ultimos 7 dias
- pedidos recientes
- ultimos chats relevantes

### `lib/chatbot/risk.ts`
Centraliza:
- calculo de `risk_score`
- clasificacion `normal | warning | critical`
- reglas complementarias locales independientes del LLM

Importante:
- el score final no debe depender solo de Gemini
- Gemini puede sugerir severidad
- backend local debe ajustar o elevar criticidad si detecta reglas duras

Ejemplos de reglas duras:
- varios mensajes sintomaticos en pocos dias
- adherencia semanal muy baja
- combinacion de sintoma serio + medicacion activa
- repeticion de alertas warning en ventana corta

### `lib/chatbot/service.ts`
Orquesta el flujo completo:
1. valida input
2. carga contexto
3. llama a Gemini
4. parsea salida estructurada
5. calcula riesgo final
6. persiste `patient_chat_logs`
7. crea alertas/notificaciones derivadas
8. devuelve respuesta al frontend

### `lib/chatbot/alerts.ts`
Encapsula:
- creacion de `doctor_patient_alerts`
- deduplicacion de alertas criticas
- notificaciones derivadas al paciente via `patient_notifications`

---

## Cambios De Base De Datos

## 1. Nueva tabla `patient_chat_logs`

Propuesta minima:

```sql
create table public.patient_chat_logs (
  patient_chat_log_id bigint generated by default as identity primary key,
  patient_id integer not null references public.patients (patient_id) on delete cascade,
  active_doctor_id integer null references public.active_doctors (active_doctor_id) on delete set null,
  patient_medication_id integer null references public.patient_medications (patient_medication_id) on delete set null,
  message_user text not null,
  message_ai text not null,
  severity text not null check (severity in ('normal', 'warning', 'critical')),
  risk_score numeric(5,4) not null check (risk_score >= 0 and risk_score <= 1),
  symptom_tags jsonb not null default '[]'::jsonb,
  context_snapshot jsonb not null default '{}'::jsonb,
  llm_provider text not null default 'gemini',
  llm_model text null,
  created_at timestamptz not null default timezone('utc', now())
);
```

Justificacion:
- guarda historial clinico resumido
- permite auditoria simple
- soporta resumen semanal
- evita reconstruir contexto desde texto libre

Indices recomendados:
- `(patient_id, created_at desc)`
- `(active_doctor_id, created_at desc)` parcial donde `active_doctor_id is not null`
- `(severity, created_at desc)`

### 2. Nueva tabla `doctor_patient_alerts`

Propuesta:

```sql
create table public.doctor_patient_alerts (
  doctor_patient_alert_id bigint generated by default as identity primary key,
  patient_id integer not null references public.patients (patient_id) on delete cascade,
  active_doctor_id integer not null references public.active_doctors (active_doctor_id) on delete cascade,
  patient_chat_log_id bigint null references public.patient_chat_logs (patient_chat_log_id) on delete set null,
  severity text not null check (severity in ('warning', 'critical')),
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz null,
  closed_at timestamptz null
);
```

Justificacion:
- resuelve la necesidad real del medico: ver alertas accionables
- no contamina `prescription_requests`
- no duplica el inbox del paciente
- permite workflow simple de revision

Indices recomendados:
- `(active_doctor_id, status, created_at desc)`
- `(patient_id, created_at desc)`

### 3. Nueva tabla `patient_weekly_risk_snapshots`

Propuesta:

```sql
create table public.patient_weekly_risk_snapshots (
  patient_weekly_risk_snapshot_id bigint generated by default as identity primary key,
  patient_id integer not null references public.patients (patient_id) on delete cascade,
  active_doctor_id integer not null references public.active_doctors (active_doctor_id) on delete cascade,
  week_start date not null,
  week_end date not null,
  adherence_score numeric(5,4) not null,
  symptom_score numeric(5,4) not null,
  request_score numeric(5,4) not null,
  final_risk_score numeric(5,4) not null,
  final_status text not null check (final_status in ('normal', 'warning', 'critical')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (patient_id, week_start)
);
```

Justificacion:
- evita recalcular todo en cada render del medico
- soporta el semaforo de pacientes
- sirve de base para analytics futuras

### 4. Cambios en `patient_notifications`

No crear tabla nueva para mensajes del medico al paciente. Extender checks/tipos actuales para soportar:
- nuevo `type`: `doctor_follow_up_requested`
- opcionalmente `chatbot_warning_logged`
- opcionalmente `chatbot_critical_alert_sent`

Tambien ampliar helpers de `lib/patient/types.ts` y [`lib/patient/notifications.ts`](/home/bachu/MedFlow/lib/patient/notifications.ts).

### 5. RLS y migraciones

Agregar una nueva migracion en `supabase/migrations/` para:
- crear tablas nuevas
- habilitar RLS
- crear indices
- agregar triggers `set_updated_at` donde aplique

Observacion:
- el proyecto actualmente usa admin client para la mayoria de los writes protegidos
- aun asi, las tablas nuevas deben quedar con RLS habilitado para mantener consistencia con el resto del esquema

---

## APIs Nuevas O Modificadas

## Paciente

### `POST /api/patient/chatbot/messages`
Responsabilidad:
- validar sesion paciente
- recibir `{ message: string }`
- ejecutar flujo conversacional
- devolver:

```ts
{
  reply: string;
  severity: "normal" | "warning" | "critical";
  risk_score: number;
  created_alert: boolean;
  disclaimer: string;
}
```

Validaciones:
- mensaje obligatorio
- largo maximo razonable, por ejemplo 800-1000 caracteres
- rate limiting basico por paciente en backend
- sanitizacion de espacios y entradas vacias

### `GET /api/patient/chatbot/history`
Responsabilidad:
- devolver ultimos N `patient_chat_logs`
- alimentar el modal del chat

Respuesta sugerida:
- lista descendente por `created_at`
- limite corto, por ejemplo 20 mensajes

## Medico

### `GET /api/doctor/alerts`
Lista alertas abiertas o recientes del chatbot por medico autenticado.

### `PATCH /api/doctor/alerts/[alertId]`
Permite:
- `acknowledged`
- `closed`

### `POST /api/doctor/patients/[patientId]/notify`
Reutiliza `patient_notifications` para enviar mensaje manual al paciente.

Payload sugerido:

```ts
{
  message: string;
  type?: "doctor_follow_up_requested";
}
```

Comportamiento:
- valida relacion medico-paciente
- crea `patient_notifications` con `category = 'doctor_message'`
- action URL a `/paciente/notificaciones`

## Interno

### `POST /api/internal/chatbot/weekly-risk`
Sigue el patron del endpoint interno del calendario.

Responsabilidad:
- recalcular snapshot semanal por paciente
- actualizar `patient_weekly_risk_snapshots`
- opcionalmente abrir alertas warning/critical agregadas

Proteccion:
- bearer token usando `lib/env.ts`
- conviene generalizar helper para secretos internos, en vez de acoplarlo solo a calendario

---

## Cambios En Servicios Cliente

## `services/patient/patient-service.ts`
Agregar:
- `sendPatientChatMessage(payload)`
- `listPatientChatHistory()`

Mantener el mismo patron `patientFetch<T>()`.

## `services/doctor/doctor-service.ts`
Agregar:
- `listDoctorAlerts()`
- `updateDoctorAlertStatus(alertId, payload)`
- `sendDoctorPatientNotification(patientId, payload)`

Mantener el mismo patron `doctorFetch<T>()`.

---

## Cambios En Tipos

## `lib/patient/types.ts`
Agregar:
- `PatientChatLogSummary`
- `PatientChatMessagePayload`
- `PatientChatMessageResponse`
- nuevos `PatientNotificationType`

## `lib/doctor/types.ts`
Agregar:
- `DoctorPatientAlertSummary`
- `DoctorAlertsResponse`
- `PatientRiskIndicator`

Extender `PatientSummary` y `PatientDetail` con:
- `risk_status: "normal" | "warning" | "critical" | null`
- `risk_score?: number | null`
- `last_alert_at?: string | null`

Esto permite mostrar el semaforo directamente en:
- listado de pacientes
- detalle del paciente

---

## Cambios En Frontend

## 1. Boton flotante del chatbot

Ubicacion recomendada:
- dentro de [`components/mediya/patient/patient-shell.tsx`](/home/bachu/MedFlow/components/mediya/patient/patient-shell.tsx)

Nuevo componente:
- `components/mediya/patient/patient-chatbot-launcher.tsx`

Responsabilidad:
- renderizar boton flotante fijo abajo a la derecha
- abrir/cerrar modal flotante
- quedar disponible en todas las rutas paciente

Razones:
- asegura visibilidad global
- evita duplicar implementacion en cada page
- hereda automaticamente el guard de paciente

## 2. Modal de chat

Nuevos componentes:
- `components/mediya/patient/patient-chatbot-modal.tsx`
- `components/mediya/patient/patient-chatbot-message-list.tsx`
- `components/mediya/patient/patient-chatbot-input.tsx`

Comportamiento:
- al abrir:
  - carga historial reciente
  - si no hay historial visible, muestra saludo inicial local:
    - "Hola, soy tu asistente de MedFlow. ¿En qué te puedo ayudar?"
- al enviar:
  - optimistic append del mensaje del usuario
  - muestra estado `Procesando...`
  - reemplaza con respuesta final del backend

UI:
- usar mismo lenguaje visual del shell paciente
- tarjeta translucidada, bordes suaves, emerald/blue accents
- no pantalla completa
- responsive en mobile sin tapar navegacion superior

## 3. Inline notifications en chat

Cuando backend determine:
- warning
- critical
- follow-up requested por medico

Se puede inyectar un bloque especial en el chat con copy contextual, pero la fuente oficial de persistencia para el paciente sigue siendo `patient_notifications`.

No conviene crear un sistema paralelo de notificaciones dentro del chat.

## 4. Semaforo en panel medico

### Listado de pacientes
Modificar [`components/mediya/doctor/patients-panel.tsx`](/home/bachu/MedFlow/components/mediya/doctor/patients-panel.tsx):
- agregar chip verde/amarillo/rojo por paciente
- mostrar tooltip o texto corto:
  - `Normal`
  - `En seguimiento`
  - `Requiere atencion`

Para eso, el `GET /api/doctor/patients` debe incluir el estado agregado.

### Detalle del paciente
Modificar [`components/mediya/doctor/patient-detail-panel.tsx`](/home/bachu/MedFlow/components/mediya/doctor/patient-detail-panel.tsx):
- mostrar estado actual de riesgo en el header
- mostrar bloque de alertas recientes
- agregar boton `Enviar notificacion al paciente`

---

## Logica De Riesgo

## Entradas reales ya disponibles

### Chat
- severidad del mensaje actual
- frecuencia de warnings/critical recientes
- tags de sintomas

### Adherencia
- `weekly_schedule_logs`
- resumen semanal ya calculable desde `lib/calendar/weekly-calendar.ts`

### Pedidos
- si hay pedidos abiertos prolongados
- si hubo friccion reciente con farmacia o reposicion

## Formula sugerida

Mantenerla simple y deterministica:

```text
risk_score =
  0.50 * symptom_score +
  0.35 * adherence_score +
  0.15 * request_score
```

Reglas sugeridas:
- `symptom_score`
  - normal = 0.1
  - warning = 0.5
  - critical = 0.9
  - elevar si hay multiples eventos en 72h
- `adherence_score`
  - derivado de `% missed` y `% taken_late` en 7 dias
- `request_score`
  - bajo si no hay friccion
  - medio si hay pedido activo prolongado
  - alto si hubo no stock o multiples cambios recientes

Clasificacion:
- `< 0.30` -> `normal`
- `< 0.60` -> `warning`
- `>= 0.60` -> `critical`

### Reglas de override

Aunque el score no llegue a 0.60, elevar a `critical` si:
- Gemini devuelve indicador de posible urgencia clinica
- existe combinacion de sintomas graves definida localmente
- hay dos eventos `critical` en ventana corta

Esto evita depender ciegamente del modelo.

---

## Integracion Con Gemini

## Requisitos
- agregar variable nueva en entorno, por ejemplo:
  - `GEMINI_API_KEY`
- exponer helper en `lib/env.ts` en vez de leer `process.env` directo desde el modulo del chatbot

## Recomendaciones de implementacion
- usar `fetch` server-side a Gemini desde route handler o modulo de dominio
- timeout explicito
- manejo de errores robusto
- respuesta exigida en JSON

## Guardrails
- todo mensaje del asistente debe incluir un disclaimer breve, no necesariamente repetido completo en cada burbuja
- no dar instrucciones de suspender medicacion salvo derivacion a medico/guardia
- evitar diagnosticos definitivos
- si hay fallo de proveedor:
  - persistir un log opcional de error resumido si sirve para auditoria
  - responder fallback seguro:
    - "No pude procesar tu mensaje, por favor intenta de nuevo o contacta a tu medico. Esto no reemplaza una consulta medica."

---

## Resumen Semanal

## Fuente de datos
- `patient_chat_logs`
- `weekly_schedule_logs`
- `prescription_requests`

## Salida
Persistir en `patient_weekly_risk_snapshots`:
- score final
- estado final
- resumen estructurado

Ejemplo de `summary`:

```json
{
  "chat": {
    "total_messages": 4,
    "warnings": 2,
    "criticals": 1
  },
  "adherence": {
    "scheduled": 14,
    "taken": 9,
    "taken_late": 2,
    "missed": 3
  },
  "requests": {
    "open_requests": 1,
    "last_status": "pharmacy_checking"
  }
}
```

## Ejecucion
- primero como endpoint interno manual/cron
- despues se puede automatizar

No conviene calcular este resumen en cada carga del panel medico.

---

## Edge Cases Y Validaciones

### Chat
- mensaje vacio
- mensaje demasiado largo
- spam de mensajes seguidos
- provider timeout
- JSON invalido de Gemini
- paciente sin tratamientos activos

### Contexto
- paciente sin medico primario
- paciente con varios tratamientos activos
- paciente sin calendario semanal configurado
- paciente con historial de chat vacio

### Alertas
- evitar crear multiples alertas criticas identicas en pocos minutos
- deduplicar por paciente + severidad + ventana temporal + texto normalizado
- no enviar mensaje duplicado al paciente si ya existe una alerta abierta equivalente

### UI
- boton flotante no debe tapar CTA importantes del dashboard
- en mobile el modal debe respetar safe areas
- si history carga lento, mostrar skeleton simple

---

## Plan De Implementacion Paso A Paso

## Fase 1. Persistencia y tipos
1. Crear migracion para `patient_chat_logs`, `doctor_patient_alerts`, `patient_weekly_risk_snapshots`.
2. Habilitar RLS, indices y triggers necesarios.
3. Extender `lib/patient/types.ts` y `lib/doctor/types.ts`.
4. Extender `lib/env.ts` para secretos del chatbot y procesos internos.

## Fase 2. Dominio backend
1. Crear `lib/chatbot/types.ts`.
2. Crear `lib/chatbot/context.ts`.
3. Crear `lib/chatbot/prompt.ts`.
4. Crear `lib/chatbot/risk.ts`.
5. Crear `lib/chatbot/alerts.ts`.
6. Crear `lib/chatbot/service.ts`.
7. Extender `lib/patient/notifications.ts` con nuevos tipos de mensajes doctor->patient.

## Fase 3. Endpoints
1. Crear `app/api/patient/chatbot/messages/route.ts`.
2. Crear `app/api/patient/chatbot/history/route.ts`.
3. Crear `app/api/doctor/alerts/route.ts`.
4. Crear `app/api/doctor/alerts/[alertId]/route.ts`.
5. Crear `app/api/doctor/patients/[patientId]/notify/route.ts`.
6. Crear `app/api/internal/chatbot/weekly-risk/route.ts`.

## Fase 4. Integracion medico/paciente
1. Agregar cliente `sendPatientChatMessage()` y `listPatientChatHistory()`.
2. Agregar cliente `listDoctorAlerts()`, `updateDoctorAlertStatus()`, `sendDoctorPatientNotification()`.
3. Integrar boton flotante y modal en `PatientShell`.
4. Renderizar historial y envio de mensajes en el modal.

## Fase 5. Semaforo medico
1. Extender `GET /api/doctor/patients` para incluir `risk_status`.
2. Extender `GET /api/doctor/patients/[patientId]` para incluir resumen de riesgo y alertas recientes.
3. Mostrar indicador visual en `PatientsPanel`.
4. Mostrar alertas y boton de mensaje manual en `PatientDetailPanel`.

## Fase 6. Resumen semanal
1. Implementar agregacion semanal en backend.
2. Persistir snapshots.
3. Usar snapshot mas reciente como fuente principal del semaforo, con override por alertas abiertas recientes.

## Fase 7. QA
1. Paciente sin tratamientos activos puede abrir chat y recibir respuesta segura sin contexto clinico profundo.
2. Mensaje critico crea `patient_chat_logs` y `doctor_patient_alerts`.
3. Medico visualiza semaforo actualizado.
4. Medico envia notificacion y paciente la ve en panel actual.
5. Fallo de Gemini activa fallback sin romper UI.

---

## Cambios Minimos Y Compatibilidad

Para no romper funcionalidades existentes:
- no tocar logica de refill en [`lib/patient/medication-calculations.ts`](/home/bachu/MedFlow/lib/patient/medication-calculations.ts)
- no tocar flujo actual de pedidos salvo lectura de contexto
- no duplicar notificaciones del paciente fuera de `patient_notifications`
- no mover reglas de negocio a componentes React
- no exponer API keys del proveedor en cliente

El feature debe apoyarse en los modulos existentes, no reemplazarlos.

---

## Resultado Esperado En Esta Arquitectura

Con esta adaptacion, MedFlow quedaria con:
- chatbot flotante exclusivo para paciente
- respuestas contextualizadas con tratamientos, adherencia y pedidos
- historial persistido y auditable
- alertas automaticas al medico para casos criticos
- semaforo de riesgo visible en la superficie del medico
- mensajes manuales medico -> paciente reutilizando el inbox actual
- base lista para resumen semanal sin duplicar sistemas existentes

## Conclusion

La especificacion original es viable, pero requiere dos ajustes clave para encajar bien en MedFlow:

1. Reutilizar `patient_notifications` para mensajes al paciente en vez de crear `doctor_notifications`.
2. Agregar una tabla especifica de alertas para medico y una tabla de snapshots semanales, porque hoy el sistema medico no tiene un inbox general y el semaforo necesita persistencia agregada.

Esa version mantiene el alcance pedido, minimiza impacto sobre flujos existentes y sigue las convenciones actuales del proyecto.
