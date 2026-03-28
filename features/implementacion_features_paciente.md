# MEDIYA — Implementación adaptada del módulo Paciente

## 1. Propósito del documento

Este archivo reemplaza conceptualmente a `features/FeaturePaciente.md` como base de trabajo para la futura implementación del módulo Paciente, pero adaptado al estado real del proyecto `MEDIYA`.

No describe una app nueva ni una solución idealizada desde cero. Define cómo implementar la experiencia del paciente respetando:

- la arquitectura actual de Next.js App Router
- el sistema de autenticación ya existente con Supabase Auth
- el diseño visual ya presente en `app/(public)/*`, `app/(doctor)/*` y `components/mediya/*`
- el schema real hoy vigente en Supabase
- las relaciones actuales entre médicos, pacientes, tratamientos, pedidos y archivos

Este documento es exclusivamente para futura implementación. No implica cambios de código ni cambios de base de datos en esta etapa.

---

## 2. Estado actual verificado del proyecto

### 2.1 Stack y arquitectura vigentes

Estado verificado en el codebase:

- `next@16.2.1`
- `react@19.2.4`
- Tailwind CSS v4 vía `app/globals.css`
- App Router bajo `app/`
- componentes compartidos bajo `components/`
- Supabase para Auth, Postgres y Storage
- Route Handlers server-side bajo `app/api/**/route.ts`

### 2.2 Convenciones actuales que la futura implementación debe respetar

- La UI pública ya usa una identidad visual concreta: fondos con gradientes suaves, cards claras, radios amplios, tipografía definida en `app/globals.css`, y primitives reutilizables en `components/ui/*`.
- El panel médico ya usa shells y guards propios, no lógica dispersa dentro de cada página.
- Los flujos sensibles no se resuelven desde el cliente directo contra Supabase: hoy pasan por `Route Handlers` con validación server-side y `createAdminSupabaseClient()`.
- La app ya está segmentada por dominios:
  - `services/auth/*` para auth cliente
  - `services/doctor/*` para cliente del dominio médico
  - `lib/auth/*`, `lib/doctor/*`, `lib/supabase/*` para helpers, tipos y acceso

### 2.3 Estado actual del login y roles

Hoy ya existe login unificado para médicos y pacientes:

- el formulario vive en `components/mediya/forms/login-form.tsx`
- la resolución email/DNI vive en `app/api/auth/resolve-login-identifier/route.ts`
- la resolución de rol vive en `app/api/auth/session-role/route.ts`

La lógica actual ya detecta si la sesión corresponde a:

- `doctor`
- `patient`

Problema actual relevante:

- el login del paciente todavía no redirige a un dashboard paciente real
- hoy, si el rol es `patient`, la navegación termina en `/exito`, que es una pantalla transitoria

Conclusión:

- el login del paciente no debe reimplementarse
- debe extenderse el flujo actual para redirigir a un dashboard paciente real

---

## 3. Estructura real de base de datos verificada en Supabase

La estructura fue contrastada contra el MCP de Supabase y contra las migraciones del repo.

### 3.1 Tablas existentes

Tablas públicas relevantes hoy activas:

- `approved_doctors`
- `active_doctors`
- `pharmacies`
- `patients`
- `patient_doctors`
- `patient_medications`
- `prescription_requests`
- `prescription_files`

### 3.2 Relación entre tablas

#### `approved_doctors`

- padrón base de médicos aprobados
- puede estar asociado a `auth.users` mediante `claimed_by_auth_user_id`
- se vincula 1 a 1 con `active_doctors` vía `approved_doctor_id`

#### `active_doctors`

- representa al médico operativo autenticado
- `auth_user_id` -> `auth.users.id`
- `approved_doctor_id` -> `approved_doctors.approved_doctor_id`
- es referenciado por:
  - `patients.created_by_active_doctor_id`
  - `patient_doctors.active_doctor_id`
  - `patient_medications.active_doctor_id`
  - `prescription_requests.active_doctor_id`
  - `prescription_files.active_doctor_id`

#### `pharmacies`

- catálogo de farmacias
- es referenciada por:
  - `patients.preferred_pharmacy_id`
  - `prescription_requests.preferred_pharmacy_id`

#### `patients`

- representa al paciente autenticable
- `auth_user_id` -> `auth.users.id`
- `preferred_pharmacy_id` -> `pharmacies.pharmacy_id`
- `created_by_active_doctor_id` -> `active_doctors.active_doctor_id`
- estados actuales de cuenta:
  - `invited`
  - `active`
  - `disabled`

#### `patient_doctors`

- tabla pivote entre pacientes y médicos
- `patient_id` -> `patients.patient_id`
- `active_doctor_id` -> `active_doctors.active_doctor_id`
- permite relación muchos a muchos
- `is_primary` marca la relación principal del paciente con un médico
- existe unicidad por par `(patient_id, active_doctor_id)`

#### `patient_medications`

- es la tabla vigente para tratamientos/medicación del paciente
- no existe una tabla `treatments` separada
- columnas actuales relevantes:
  - `patient_medication_id`
  - `patient_id`
  - `active_doctor_id`
  - `medication_name`
  - `presentation`
  - `dose_text`
  - `frequency_text`
  - `pills_per_box`
  - `units_per_intake`
  - `intakes_per_day`
  - `notes`
  - `is_active`
  - `start_date`
  - `next_consultation_at`
  - `box_count`

Relaciones:

- `patient_id` -> `patients.patient_id`
- `active_doctor_id` -> `active_doctors.active_doctor_id`

#### `prescription_requests`

- es la tabla vigente para pedidos de receta/reposición
- no debe crearse una tabla paralela `medication_requests` o `prescription_requests_v2`
- columnas actuales relevantes:
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
  - `medication_name_snapshot`
  - `dose_snapshot`
  - `frequency_snapshot`

Estados actuales válidos:

- `pending`
- `reviewed`
- `uploaded`
- `rejected`
- `cancelled`

Relaciones:

- `patient_id` -> `patients.patient_id`
- `active_doctor_id` -> `active_doctors.active_doctor_id`
- `patient_medication_id` -> `patient_medications.patient_medication_id`
- `preferred_pharmacy_id` -> `pharmacies.pharmacy_id`

#### `prescription_files`

- almacena el archivo de receta vinculado a un pedido
- no representa el pedido: representa el archivo resultante
- columnas actuales relevantes:
  - `prescription_file_id`
  - `prescription_request_id`
  - `patient_id`
  - `active_doctor_id`
  - `storage_bucket`
  - `storage_path`
  - `original_filename`
  - `mime_type`
  - `file_size_bytes`
  - `uploaded_at`
  - `is_current`

Relaciones:

- `prescription_request_id` -> `prescription_requests.prescription_request_id`
- `patient_id` -> `patients.patient_id`
- `active_doctor_id` -> `active_doctors.active_doctor_id`

### 3.3 Conclusión de modelado

Para el módulo Paciente no corresponde:

- crear tabla `treatments`
- crear tabla `prescriptions` como nueva fuente de verdad
- crear tabla `medication_requests`
- duplicar campos existentes con otro naming paralelo

La implementación futura debe montarse sobre:

- `patients`
- `patient_doctors`
- `patient_medications`
- `prescription_requests`
- `prescription_files`
- `pharmacies`

---

## 4. Diferencias entre el feature viejo y el estado real del sistema

El archivo original `features/FeaturePaciente.md` parte de supuestos que hoy ya no son exactos o necesitan adaptación.

### 4.1 Lo que sí sigue siendo válido

- el paciente no se registra libremente
- el paciente debe iniciar sesión con una cuenta ya creada
- el paciente debe ver sus tratamientos
- el paciente no edita el tratamiento
- el paciente puede iniciar un pedido de receta
- debe existir una UI de tracking del pedido
- deben existir reglas para impedir pedidos demasiado anticipados

### 4.2 Lo que debe corregirse

#### Naming de tratamientos

El feature viejo habla de:

- `treatments`
- `prescriptions`
- `treatment_id`

En el sistema real, la entidad correcta es:

- `patient_medications`
- `patient_medication_id`

#### Naming del pedido

El feature viejo propone estados y campos como si el pedido todavía no existiera.

En el sistema real, la entidad correcta ya existe:

- `prescription_requests`

y sus estados válidos actuales son:

- `pending`
- `reviewed`
- `uploaded`
- `rejected`
- `cancelled`

No se debe inventar un estado inicial nuevo como `pending_doctor_review` si no va acompañado por un cambio deliberado de schema. Para la primera implementación paciente, el alta del pedido debe usar `pending`.

#### Cálculo de última reposición

El feature viejo asume que existe una “fecha de último pedido confirmado” inequívoca.

Hoy la base no tiene un campo específico del tipo:

- `last_refill_confirmed_at`
- `dispensed_at`
- `delivered_to_patient_at`

Lo que sí existe es:

- `requested_at`
- `resolved_at`
- `status`
- archivo subido en `prescription_files`

Por eso, la lógica de agotamiento y reposición debe adaptarse con cuidado:

- ancla base segura inicial: `patient_medications.start_date`
- proxy opcional para renovación: último `prescription_requests` con `status = 'uploaded'` y `resolved_at`

Esa proxy sirve solo como aproximación operativa. No equivale necesariamente a “medicación ya retirada por el paciente”. Esto debe quedar documentado en la implementación futura y en la UX.

---

## 5. Objetivo funcional adaptado al proyecto actual

Implementar la experiencia post-login del paciente dentro de MEDIYA reutilizando la infraestructura actual.

### 5.1 Alcance funcional

La primera versión del módulo Paciente debe permitir:

1. autenticar al paciente con el login unificado actual
2. resolver su rol con la lógica ya existente
3. redirigirlo a un dashboard paciente real
4. mostrar sus tratamientos activos basados en `patient_medications`
5. mostrar el estado calculado de consumo para cada tratamiento
6. permitir crear un pedido de receta basado en un tratamiento existente
7. mostrar el historial y tracking de pedidos usando `prescription_requests`
8. mantener el tratamiento como entidad read-only para el paciente

### 5.2 Fuera de alcance para esta iteración

No debe incluir:

- edición del perfil del paciente
- edición de tratamientos por parte del paciente
- eliminación o pausa manual de tratamientos por parte del paciente
- cambios de schema no indispensables
- pago, entrega, logística o stock de farmacia
- notificaciones push o email

---

## 6. Arquitectura recomendada para futura implementación

### 6.1 Routing recomendado

Para mantener consistencia con el repo:

- crear un route group propio del paciente, por ejemplo `app/(patient)/*`
- exponer un dashboard principal del paciente bajo una ruta clara, por ejemplo:
  - `/paciente`
  - o `/panel/paciente`

Recomendación:

- usar `/paciente`

Motivos:

- evita mezclar el panel del médico con el del paciente
- es consistente con el uso actual de `/panel` como superficie del médico

### 6.2 Shell y guard del paciente

Debe replicarse el patrón del médico:

- `components/mediya/patient/patient-shell.tsx`
- `components/mediya/patient/patient-access-guard.tsx`

El guard debe:

- leer la sesión desde el browser Supabase client
- usar `resolveSessionRole`
- permitir solo `patient`
- redirigir a `/login` si no hay sesión o si el rol no es paciente

No debe duplicar la resolución de rol fuera del flujo actual.

### 6.3 APIs server-side recomendadas

La capa paciente debe seguir la arquitectura actual basada en `app/api/**`.

Rutas sugeridas:

- `app/api/patient/dashboard/route.ts`
- `app/api/patient/requests/route.ts`

Opcional según división futura:

- `app/api/patient/medications/route.ts`
- `app/api/patient/requests/[requestId]/route.ts`

### 6.4 Validación server-side

Como las tablas hoy tienen RLS habilitado pero sin políticas aplicadas, la lógica paciente tampoco debe escribir directo desde el cliente a Supabase.

La futura implementación debe:

- validar la sesión del paciente server-side
- resolver `patients.patient_id` por `auth_user_id`
- operar con `createAdminSupabaseClient()` desde Route Handlers
- verificar siempre que cada tratamiento o pedido pertenece al paciente autenticado

### 6.5 Helper de sesión recomendado

Así como hoy existe `lib/auth/doctor-session.ts`, la implementación paciente debería crear un helper análogo, por ejemplo:

- `lib/auth/patient-session.ts`

Responsabilidades:

- extraer bearer token
- resolver `auth.users.id`
- buscar `patients.patient_id`
- devolver contexto del paciente autenticado

No debe mezclarse con la sesión del médico.

---

## 7. Diseño y UX que deben respetar la identidad actual

### 7.1 Dirección visual

La interfaz del paciente no debe parecer una app externa ni una demo aislada. Debe continuar el lenguaje visual existente:

- cards claras con sombra suave
- fondos con gradientes radiales y lineales sutiles
- `Badge`, `Card`, `Button`, `Input`, `Label` de `components/ui/*`
- tipografía definida en `app/globals.css`
- paleta basada en los tokens actuales:
  - `--background`
  - `--foreground`
  - `--primary`
  - `--secondary`
  - `--muted`
  - `--accent`

### 7.2 Layout responsive

El dashboard paciente debe evitar una sola columna eterna en desktop.

Regla de layout:

- mobile: una columna
- tablet: grid de 2 columnas cuando el ancho lo soporte
- desktop: composición mixta con hero superior y grid de cards

### 7.3 Componentes recomendados

Separación sugerida:

- `components/mediya/patient/patient-dashboard.tsx`
- `components/mediya/patient/patient-treatment-card.tsx`
- `components/mediya/patient/patient-request-tracker.tsx`
- `components/mediya/patient/patient-empty-state.tsx`

### 7.4 Microcopy

La app actual ya usa copy en español simple y directo. El módulo paciente debe continuar ese tono:

- claro
- breve
- operativo
- sin lenguaje excesivamente técnico

---

## 8. Modelo funcional del dashboard paciente

### 8.1 Encabezado principal

Debe mostrar:

- saludo con nombre del paciente
- resumen corto del módulo
- estado general de sus tratamientos y pedidos

Ejemplo conceptual:

- “Hola, Sofía”
- “Acá podés revisar tus tratamientos activos y pedir una nueva receta cuando corresponda.”

### 8.2 Sección “Mis tratamientos”

Debe ser el bloque principal del dashboard.

Fuente de verdad:

- `patient_medications`

Filtro mínimo:

- tratamientos del `patient_id` autenticado
- priorizar `is_active = true`

Orden sugerido:

- activos primero
- luego por `start_date` descendente
- o por mayor urgencia calculada

### 8.3 Sección “Mis pedidos”

Debe listar el historial reciente y el tracking de estado de `prescription_requests`.

Orden:

- `requested_at desc`

Debe permitir visualizar:

- medicación asociada
- fecha del pedido
- estado actual
- si ya existe receta cargada
- farmacia preferida si aplica

---

## 9. Adaptación correcta del modelo de tratamiento

### 9.1 Entidad correcta

Cada card del paciente representa un registro de:

- `patient_medications`

No representa:

- una fila genérica de “tratamiento”
- una receta puntual
- un pedido puntual

### 9.2 Campos que deben mostrarse desde el schema actual

Campos ya disponibles para la card:

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

Datos derivados que pueden obtenerse vía join o agregación:

- médico responsable desde `active_doctor_id`
- último pedido desde `prescription_requests`
- farmacia preferida desde `patients.preferred_pharmacy_id`

### 9.3 Interpretación correcta de cantidad disponible

Para cálculo de duración, el total de unidades teóricas del tratamiento debe basarse en:

- `pills_per_box * box_count`

Siempre que `pills_per_box` exista y sea mayor a cero.

Si faltan datos críticos:

- no debe romperse la UI
- debe mostrarse un estado de “Información incompleta”

Ejemplos de datos críticos para cálculo:

- `pills_per_box`
- `units_per_intake`
- `intakes_per_day`
- `start_date`

---

## 10. Lógica de cálculo adaptada al schema real

### 10.1 Fórmulas base

Con la estructura actual, la dosis diaria efectiva puede calcularse como:

- `daily_units = units_per_intake * intakes_per_day`

Cantidad total disponible estimada:

- `total_units = pills_per_box * box_count`

Duración estimada:

- `estimated_duration_days = total_units / daily_units`

Días transcurridos:

- `elapsed_days = today - anchor_date`

Días restantes:

- `remaining_days = estimated_duration_days - elapsed_days`

Porcentaje restante:

- `remaining_percentage = max(0, remaining_days / estimated_duration_days)`

### 10.2 Fecha ancla

Fecha base segura inicial:

- `patient_medications.start_date`

Proxy opcional avanzada:

- último `prescription_requests` del medicamento con `status = 'uploaded'`
- usar `resolved_at` como proxy de renovación si el negocio acepta esa aproximación

Regla recomendada para v1:

- usar `start_date` como ancla oficial
- mostrar el historial de pedidos aparte
- no reanclar automáticamente al último pedido cargado salvo definición funcional explícita

Motivo:

- `uploaded` significa que el médico subió una receta
- no confirma por sí mismo que el paciente ya retiró la medicación

### 10.3 Estados visuales de la barra

La barra de consumo puede implementarse con estos umbrales:

- verde: más del 40% restante
- ámbar/naranja: entre 15% y 40%
- rojo: menos del 15%

### 10.4 Estado incompleto

Si falta alguno de los datos estructurados necesarios, la card debe:

- mantener el nombre del medicamento y metadatos disponibles
- mostrar mensaje tipo “Información incompleta para estimar reposición”
- desactivar lógica de agotamiento automática

No debe inferir datos desde `dose_text` o `frequency_text` mediante parsing textual frágil si ya existen campos estructurados.

---

## 11. Regla para habilitar “Pedir más”

### 11.1 Fuente de verdad para elegibilidad

La elegibilidad debe basarse en datos estructurados de `patient_medications`, no en el texto renderizado.

### 11.2 Regla recomendada

Si se puede calcular duración:

- `estimated_duration_days = total_units / daily_units`
- `tolerance_days = estimated_duration_days * 0.2`
- habilitar pedido cuando:
  - `remaining_days <= tolerance_days`
  - o `remaining_days <= 0`

Si no se puede calcular duración:

- deshabilitar el CTA automático
- mostrar mensaje de falta de información

### 11.3 Regla anti-duplicado recomendada

Además de la validación temporal, el backend paciente debe impedir crear múltiples pedidos abiertos para el mismo tratamiento.

Regla sugerida:

- si ya existe un `prescription_requests` para ese `patient_medication_id` con `status` en:
  - `pending`
  - `reviewed`

entonces no crear uno nuevo.

Opcional según decisión de negocio:

- evaluar también `uploaded` mientras el paciente no haya iniciado un nuevo ciclo real

### 11.4 Mensaje UX al bloquear

Cuando el botón esté bloqueado, no debe ocultarse. Debe verse disabled y acompañado por un texto claro.

Ejemplos:

- “Todavía deberías tener medicación disponible.”
- “Ya hay un pedido en curso para este tratamiento.”
- “Faltan datos del tratamiento para calcular una nueva reposición.”

---

## 12. Creación de pedidos adaptada a la base actual

### 12.1 Tabla correcta

El pedido se debe crear en:

- `prescription_requests`

### 12.2 Valores a persistir

Al crear el pedido desde paciente, se debe insertar:

- `patient_id`
- `active_doctor_id`
- `patient_medication_id`
- `preferred_pharmacy_id`
- `status = 'pending'`
- `patient_note` si la UX incorpora observaciones
- snapshots del tratamiento:
  - `medication_name_snapshot`
  - `dose_snapshot`
  - `frequency_snapshot`

### 12.3 Fuente de cada dato

- `patient_id`: del paciente autenticado
- `active_doctor_id`: del propio `patient_medications.active_doctor_id`
- `patient_medication_id`: del tratamiento seleccionado
- `preferred_pharmacy_id`: de `patients.preferred_pharmacy_id`
- snapshots: del registro actual en `patient_medications`

### 12.4 Regla de ownership

El backend debe verificar siempre:

- que el tratamiento pertenece al paciente autenticado
- que el pedido se crea usando el médico asociado a ese tratamiento

No debe aceptar IDs arbitrarios enviados desde el cliente sin revalidación.

---

## 13. Tracking visual del pedido

### 13.1 Fuente de verdad

El tracking debe renderizar estados reales de `prescription_requests.status`.

### 13.2 Mapeo UX recomendado

Estados actuales del schema y su copy sugerido:

- `pending` -> “Pedido recibido”
- `reviewed` -> “En revisión médica”
- `uploaded` -> “Receta disponible”
- `rejected` -> “Pedido rechazado”
- `cancelled` -> “Pedido cancelado”

### 13.3 Relación con archivos

Si existe un `prescription_files` actual para el pedido:

- mostrar que la receta ya fue cargada
- permitir futura descarga o visualización cuando se implemente esa capacidad

En esta etapa documental no hace falta definir la descarga pública del archivo, solo dejar claro que la receta real hoy vive en `prescription_files` + Supabase Storage.

---

## 14. Contrato de datos recomendado para el dashboard paciente

### 14.1 Dashboard agregado

La API principal del dashboard debería devolver una estructura ya normalizada para UI, evitando lógica pesada en el cliente.

Debe incluir:

- perfil básico del paciente
- tratamientos
- pedidos recientes
- joins básicos de médico y farmacia cuando agreguen valor

### 14.2 Perfil del paciente

Campos recomendados:

- `patient_id`
- `name`
- `email`
- `phone`
- `zone`
- `account_status`
- `preferred_pharmacy`

### 14.3 Tratamientos normalizados

Cada tratamiento debería salir listo para UI con:

- datos persistidos del schema
- datos derivados de cálculo
- flags de elegibilidad

Ejemplo de shape lógico:

- `patient_medication_id`
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
- `doctor`
- `latest_request`
- `calculation`
  - `can_calculate`
  - `daily_units`
  - `total_units`
  - `estimated_duration_days`
  - `elapsed_days`
  - `remaining_days`
  - `remaining_percentage`
  - `status_tone`
  - `can_request_refill`
  - `blocked_reason`

### 14.4 Pedidos normalizados

Cada pedido debería incluir:

- `prescription_request_id`
- `patient_medication_id`
- `medication_name`
- `status`
- `requested_at`
- `resolved_at`
- `patient_note`
- `doctor_note`
- `preferred_pharmacy`
- `current_file`

---

## 15. Archivos y capas a crear en una futura implementación

### 15.1 Capa de app

Rutas sugeridas:

- `app/(patient)/layout.tsx`
- `app/(patient)/paciente/page.tsx`
- `app/api/patient/dashboard/route.ts`
- `app/api/patient/requests/route.ts`

### 15.2 Capa de componentes

Sugerido:

- `components/mediya/patient/patient-shell.tsx`
- `components/mediya/patient/patient-access-guard.tsx`
- `components/mediya/patient/patient-dashboard.tsx`
- `components/mediya/patient/patient-treatment-card.tsx`
- `components/mediya/patient/patient-request-tracker.tsx`

### 15.3 Capa de servicios cliente

Sugerido:

- `services/patient/patient-service.ts`

### 15.4 Capa de dominio y tipos

Sugerido:

- `lib/patient/types.ts`
- `lib/patient/medication-calculations.ts`

### 15.5 Capa de auth

Sugerido:

- `lib/auth/patient-session.ts`

---

## 16. Criterios de calidad que deben respetar la base actual

### 16.1 No duplicar lógica de auth

Debe reutilizarse:

- `loginWithPassword`
- `resolveLoginIdentifier`
- `resolveSessionRole`

Solo se extiende:

- redirección por rol
- guard de acceso del paciente

### 16.2 No inventar otro dominio de tratamientos

Toda referencia funcional en código y documentación futura debe hablar en términos de:

- `patient_medications`
- `patient_medication_id`

Si en UI se usa la palabra “tratamiento”, debe ser solo como lenguaje de producto, no como tabla o contrato técnico paralelo.

### 16.3 Mantener separación cliente/backend

- cliente React: render, estado local, submit HTTP
- Route Handlers: validación de ownership, reglas de negocio, acceso admin a Supabase

### 16.4 Tipado explícito

La implementación futura debe crear tipos nuevos específicos del dominio paciente. No conviene reutilizar tipos del médico si la forma de consumo diverge.

### 16.5 Lógica de cálculo centralizada

Los cálculos de duración y elegibilidad no deben quedar duplicados dentro de componentes.

Deben ir a helpers del dominio, por ejemplo:

- `lib/patient/medication-calculations.ts`

### 16.6 Tolerancia a datos incompletos

La app no debe asumir que todos los tratamientos existentes están completos al 100%.

Debe contemplar:

- `pills_per_box` nulo
- `notes` nulo
- `next_consultation_at` nulo
- pedidos inexistentes
- receta aún no subida

### 16.7 Consistencia con RLS actual

Hoy RLS está habilitado pero no hay políticas definidas. Mientras eso siga así:

- toda operación sensible del paciente debe pasar por servidor
- no debe proponerse escritura directa desde el browser client

---

## 17. Decisiones de base de datos para esta funcionalidad

### 17.1 Qué NO cambiar en la primera implementación

No hace falta crear migraciones nuevas para implementar la primera versión del dashboard paciente si se acepta esta base funcional:

- ancla de cálculo basada en `start_date`
- pedidos basados en `prescription_requests`
- tracking basado en estados existentes

### 17.2 Qué gap de datos sí queda documentado

Si a futuro se necesitara una trazabilidad exacta del momento real de reposición, retiro o dispensación, el schema actual es limitado.

Falta una marca inequívoca del tipo:

- fecha efectiva de nueva caja
- confirmación de retiro
- confirmación de entrega

Pero ese gap no obliga a cambiar el schema para la primera implementación del módulo paciente.

### 17.3 Regla documental para futuros cambios DDL

Si más adelante se decide cambiar schema:

- debe hacerse con el MCP de Supabase
- debe reflejarse en `supabase/migrations/`
- debe evitar romper relaciones actuales entre médicos, pacientes, medicamentos y pedidos

---

## 18. Flujo funcional propuesto extremo a extremo

### 18.1 Login

1. El paciente entra a `/login`.
2. Usa email o DNI.
3. El sistema resuelve email real si ingresó DNI.
4. Hace `signInWithPassword`.
5. Se resuelve el rol con `/api/auth/session-role`.
6. Si el rol es `patient`, debe redirigirse a `/paciente`.

### 18.2 Dashboard

1. El guard del paciente valida sesión y rol.
2. El dashboard llama a `/api/patient/dashboard`.
3. El backend resuelve el `patient_id` por `auth_user_id`.
4. Trae perfil, tratamientos y pedidos.
5. Calcula estado de consumo y elegibilidad por tratamiento.
6. Renderiza cards y tracking.

### 18.3 Crear pedido

1. El paciente pulsa “Pedir más”.
2. El cliente llama a `POST /api/patient/requests`.
3. El backend valida ownership del tratamiento.
4. El backend valida elegibilidad temporal.
5. El backend valida ausencia de pedido abierto conflictivo.
6. Inserta en `prescription_requests` con snapshots.
7. La UI refresca el dashboard y el tracking.

### 18.4 Resolución por parte del médico

Ese flujo ya está parcialmente preparado hoy:

- el médico ve pedidos en `components/mediya/doctor/requests-panel.tsx`
- el médico puede subir la receta a `prescription_files`
- el pedido pasa a `uploaded`

Esto confirma que el módulo paciente debe acoplarse al flujo médico existente, no crear uno aparte.

---

## 19. Checklist de aceptación para futura implementación

La implementación futura debería considerarse correcta si cumple todo esto:

- el login paciente reutiliza el flujo actual y redirige a un dashboard real
- existe un guard específico de paciente
- el dashboard usa el diseño vigente del proyecto
- los tratamientos salen de `patient_medications`
- los pedidos salen de `prescription_requests`
- no se crean tablas paralelas para tratamientos o pedidos
- la creación de pedido usa `status = 'pending'`
- la UI bloquea pedidos demasiado anticipados
- la UI también bloquea pedidos duplicados abiertos
- el paciente nunca puede editar un tratamiento
- toda operación sensible pasa por Route Handlers con validación server-side
- la lógica de cálculo está centralizada y no duplicada en varios componentes
- la UI tolera datos incompletos sin romper render

---

## 20. Resumen ejecutivo

La adaptación correcta del módulo Paciente al estado actual de MEDIYA es:

- reutilizar el login y la resolución de rol ya existentes
- crear un dashboard paciente real, no una pantalla aislada
- usar `patient_medications` como fuente de verdad de tratamientos
- usar `prescription_requests` como fuente de verdad de pedidos
- usar `prescription_files` como fuente de verdad del archivo de receta
- calcular duración y elegibilidad desde campos estructurados ya presentes
- no crear nuevas tablas mientras no sean estrictamente necesarias
- preservar la arquitectura actual basada en App Router, Route Handlers, guards por rol y UI reusable

Ese es el camino consistente con el codebase, con Supabase y con las relaciones reales entre médicos, pacientes, tratamientos y recetas dentro de MEDIYA.
