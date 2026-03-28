MEDIYA — Panel médico (post login)

## 0. Estado actual verificado en el proyecto y en Supabase


Antes de implementar el panel médico hay que partir del estado real del codebase y de la base:

- El proyecto actual ya usa `Next.js App Router` y hoy expone la lógica server-side mediante `app/api/**/route.ts`.
- La autenticación ya está conectada a Supabase y el flujo de alta de médicos ya usa `createAdminSupabaseClient()` desde `lib/supabase/admin.ts`.
- Las tablas existentes en Supabase, verificadas con el MCP server, son:
  - `approved_doctors`
  - `active_doctors`
  - `pharmacies`
  - `patients`
  - `patient_doctors`
- En la base actual `patients.auth_user_id` es `NOT NULL` y `UNIQUE`. Esto significa que hoy no alcanza con “crear un paciente lógico”: para crear un paciente en el panel médico también hay que crearle una cuenta real en `auth.users`.
- `RLS` está habilitado en las tablas actuales, pero en las migraciones del repo todavía no hay políticas de acceso declaradas para estas tablas. Por eso, en esta etapa, el panel médico no debe escribir directamente desde el cliente a Supabase.

## 1. Criterio correcto de manejo de base de datos en esta app

Para mantener consistencia con el codebase actual y evitar romper seguridad:

- El cliente React del médico solo debe encargarse de UI, formularios y llamadas HTTP.
- Las operaciones sensibles deben vivir en `Route Handlers` bajo `app/api/doctor/**/route.ts`.
- Esos handlers deben correr con `runtime = "nodejs"` y usar `createAdminSupabaseClient()` para:
  - validar sesión
  - resolver qué `active_doctor` está autenticado
  - ejecutar altas y lecturas con control de permisos del lado servidor
- El cliente de navegador de Supabase debe seguir usándose para login/logout y obtención de sesión, no para crear pacientes ni subir recetas en forma directa.

### 1.1. Regla práctica para permisos

Cada endpoint nuevo del panel médico debe hacer siempre este orden:

1. Leer el bearer token o la sesión actual.
2. Resolver `auth.users.id`.
3. Buscar el `active_doctors.active_doctor_id` vinculado a ese usuario.
4. Operar solo sobre pacientes y pedidos relacionados a ese médico.

Sin esa validación previa no hay panel médico seguro, aunque exista RLS.

### 1.2. Operaciones multi-paso

Hay dos flujos donde no conviene dejar lógica “suelta”:

- crear cuenta de paciente
- subir receta y vincularla al pedido

Ambos deben implementarse como operaciones server-side controladas. Si el flujo toca Auth + tablas SQL + Storage, el handler tiene que contemplar rollback compensatorio.

Ejemplo importante:

- Si se crea el usuario en `auth.users` pero falla el insert en `patients`, el handler debe borrar ese usuario recién creado, igual que hoy ya se hace en el registro del médico cuando falla el RPC.

## 2. Objetivo funcional del panel médico

Una vez autenticado, el médico debe entrar a un panel con dos módulos:

- `Pacientes`
- `Pedidos`

La diferencia con el documento anterior es que acá ya se define cómo hacerlo bien sobre la base actual.

## 3. Sección Pacientes

## 3.1. Qué debe permitir

El módulo de pacientes debe permitir que el médico:

- cree un paciente y su cuenta de acceso
- lo vincule automáticamente consigo mismo
- consulte el listado de pacientes asociados
- entre al detalle de cada paciente
- vea su tratamiento activo y el historial de pedidos de receta

En esta etapa no hace falta edición compleja, pero sí dejar el modelo listo para crecer.

## 3.2. Crear nuevo paciente

El flujo correcto no es solo insertar en `patients`. Debe hacer todo esto:

1. Validar que el médico autenticado exista en `active_doctors`.
2. Validar unicidad de `dni` y `email`.
3. Crear el usuario del paciente en `auth.users` con rol `patient`.
4. Insertar el registro en `patients`.
5. Insertar la relación en `patient_doctors`.
6. Si se cargan tratamientos iniciales, insertarlos también.
7. Si falla cualquier paso posterior a `auth.users`, hacer cleanup del usuario creado.

### 3.2.1. Datos base del formulario

Campos mínimos:

- nombre completo
- DNI
- email
- teléfono
- dirección
- zona
- farmacia preferida

Campos recomendados para el alta real de cuenta:

- contraseña temporal generada por el sistema o enviada por el médico
- indicador de si el paciente ya activó su cuenta

### 3.2.2. Cómo crearle una cuenta al paciente

Dado el esquema actual, la forma correcta es:

- crear un `auth.users` real con `supabase.auth.admin.createUser`
- setear `app_metadata.role = "patient"` y `user_metadata.role = "patient"`
- guardar ese `auth_user_id` en `patients.auth_user_id`

No conviene dejar un paciente “sin cuenta” porque:

- hoy la tabla `patients` no lo permite
- rompería la lógica de login actual, que resuelve pacientes por `dni` o `email`

### 3.2.3. Recomendación de producto para la cuenta del paciente

Para que el flujo sea usable, conviene agregar en `patients` campos de estado de onboarding:

- `created_by_active_doctor_id integer not null references public.active_doctors(active_doctor_id)`
- `account_status text not null default 'invited'`
- `invited_at timestamptz not null default timezone('utc', now())`
- `activated_at timestamptz null`

Check recomendado:

- `account_status in ('invited', 'active', 'disabled')`

Esto evita depender de mirar `auth.users` para saber si el paciente ya recibió/activó su acceso.

## 3.3. Lista de pacientes

La lista debe consultar pacientes vinculados por `patient_doctors`, no todos los pacientes de la base.

Datos a mostrar:

- nombre
- DNI
- email
- teléfono
- zona
- farmacia preferida
- estado de cuenta del paciente

Consulta esperable del backend:

- `patients`
- join con `patient_doctors`
- join opcional con `pharmacies`
- filtro por `active_doctor_id` autenticado

## 3.4. Detalle del paciente

La vista de detalle debe agrupar:

- datos personales
- farmacia preferida
- tratamiento activo
- pedidos de receta recientes
- recetas subidas para esos pedidos

Eso evita que “Pacientes” y “Pedidos” queden completamente desconectados.

## 4. Modelo de datos faltante para tratamiento y medicación

Hoy la base no tiene una tabla para medicación del paciente. Para el panel médico hace falta crearla.

### 4.1. Nueva tabla recomendada: `patient_medications`

Propósito:

- guardar la medicación/tratamiento activo de cada paciente
- permitir que los pedidos de receta apunten a un medicamento específico

Columnas recomendadas:

- `patient_medication_id integer generated by default as identity primary key`
- `patient_id integer not null references public.patients(patient_id) on delete cascade`
- `active_doctor_id integer not null references public.active_doctors(active_doctor_id) on delete restrict`
- `medication_name text not null`
- `presentation text null`
- `dose_text text not null`
- `frequency_text text not null`
- `pills_per_box integer null`
- `units_per_intake numeric(10,2) null`
- `intakes_per_day numeric(10,2) null`
- `notes text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

Checks recomendados:

- `btrim(medication_name) <> ''`
- `btrim(dose_text) <> ''`
- `btrim(frequency_text) <> ''`
- `pills_per_box is null or pills_per_box > 0`
- `units_per_intake is null or units_per_intake > 0`
- `intakes_per_day is null or intakes_per_day > 0`

Índices recomendados:

- `(patient_id)`
- `(active_doctor_id)`
- índice parcial por `(patient_id)` donde `is_active = true`

### 4.2. Por qué esta tabla es necesaria

No conviene meter estos campos sueltos en `patients` porque un paciente puede:

- tener más de un medicamento
- cambiar de tratamiento a lo largo del tiempo
- generar pedidos para un medicamento puntual y no para “su perfil general”

## 5. Sección Pedidos

## 5.1. Qué debe representar un pedido

Un pedido no debe colgar solamente del paciente. Tiene que quedar asociado a:

- el paciente
- el médico responsable
- el medicamento específico pedido
- el estado del flujo

Si el pedido no apunta a un medicamento concreto, después no se puede saber con precisión qué receta respondió qué solicitud.

### 5.2. Nueva tabla recomendada: `prescription_requests`

Columnas recomendadas:

- `prescription_request_id integer generated by default as identity primary key`
- `patient_id integer not null references public.patients(patient_id) on delete cascade`
- `active_doctor_id integer not null references public.active_doctors(active_doctor_id) on delete restrict`
- `patient_medication_id integer not null references public.patient_medications(patient_medication_id) on delete restrict`
- `preferred_pharmacy_id integer null references public.pharmacies(pharmacy_id) on delete set null`
- `status text not null default 'pending'`
- `requested_at timestamptz not null default timezone('utc', now())`
- `resolved_at timestamptz null`
- `patient_note text null`
- `doctor_note text null`
- `medication_name_snapshot text not null`
- `dose_snapshot text not null`
- `frequency_snapshot text not null`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

Checks recomendados:

- `status in ('pending', 'reviewed', 'uploaded', 'rejected', 'cancelled')`
- `btrim(medication_name_snapshot) <> ''`
- `btrim(dose_snapshot) <> ''`
- `btrim(frequency_snapshot) <> ''`

Índices recomendados:

- `(active_doctor_id, status, requested_at desc)`
- `(patient_id, requested_at desc)`
- `(patient_medication_id)`

### 5.3. Por qué hacen falta snapshots

Aunque el pedido tenga FK a `patient_medications`, también conviene guardar snapshots del medicamento al momento del pedido.

Eso evita perder trazabilidad si después el médico cambia:

- nombre comercial
- dosis
- frecuencia

La receta debe responder al contexto exacto del pedido original.

## 6. Recetas subidas por el médico

El usuario pidió explícitamente que la receta quede guardada como foto, archivo o similar y vinculada al pedido específico. La forma correcta en Supabase no es guardar el binario en Postgres.

## 6.1. Almacenamiento correcto del archivo

La receta debe guardarse en:

- `Supabase Storage` para el archivo físico
- una tabla SQL para la metadata y la vinculación al pedido

### 6.1.1. Bucket recomendado

Crear bucket privado:

- `prescriptions`

Debe ser privado para que el acceso al archivo salga siempre por backend o mediante signed URLs controladas.

### 6.1.2. Nueva tabla recomendada: `prescription_files`

Columnas recomendadas:

- `prescription_file_id integer generated by default as identity primary key`
- `prescription_request_id integer not null references public.prescription_requests(prescription_request_id) on delete cascade`
- `patient_id integer not null references public.patients(patient_id) on delete cascade`
- `active_doctor_id integer not null references public.active_doctors(active_doctor_id) on delete restrict`
- `storage_bucket text not null default 'prescriptions'`
- `storage_path text not null unique`
- `original_filename text not null`
- `mime_type text not null`
- `file_size_bytes bigint null`
- `uploaded_at timestamptz not null default timezone('utc', now())`
- `is_current boolean not null default true`

Checks recomendados:

- `btrim(storage_bucket) <> ''`
- `btrim(storage_path) <> ''`
- `btrim(original_filename) <> ''`
- `btrim(mime_type) <> ''`
- `file_size_bytes is null or file_size_bytes > 0`

Índices recomendados:

- `(prescription_request_id)`
- `(patient_id)`
- `(active_doctor_id)`
- índice parcial único sobre `(prescription_request_id)` donde `is_current = true`

### 6.1.3. Flujo correcto de subida

Cuando el médico sube una receta:

1. El backend valida que ese pedido pertenece al médico autenticado.
2. El backend sube el archivo al bucket `prescriptions`.
3. El backend inserta la fila en `prescription_files`.
4. El backend actualiza `prescription_requests.status = 'uploaded'`.
5. El backend setea `resolved_at`.

Si falla el insert SQL luego de subir el archivo, el handler debe borrar el archivo del bucket para no dejar basura huérfana.

## 7. Tablas existentes que deben ajustarse

## 7.1. `patients`

Mantener:

- identidad
- contacto
- zona
- `preferred_pharmacy_id`
- `auth_user_id`

Agregar para que el alta por médico sea trazable:

- `created_by_active_doctor_id`
- `account_status`
- `invited_at`
- `activated_at`

## 7.2. `patient_doctors`

Se mantiene como tabla de vínculo y sigue siendo necesaria.

Reglas:

- al crear paciente desde el panel se debe insertar automáticamente
- el médico creador debe quedar con `is_primary = true`
- si en el futuro se suma otro médico, no debe romper el índice parcial que garantiza un único primary por paciente

## 7.3. `pharmacies`

La tabla ya existe y ya tiene seed.

No hace falta recrearla. Solo hay que usarla como catálogo:

- selector en el formulario de paciente
- referencia opcional en el pedido de receta

## 8. RLS y seguridad

Como la base actual tiene RLS habilitado pero no políticas declaradas en las migraciones, el plan correcto es dividir la implementación en dos niveles.

### 8.1. Etapa inmediata

Resolver todo por backend con `Route Handlers` y `service role`, manteniendo autorización manual:

- `GET /api/doctor/patients`
- `POST /api/doctor/patients`
- `GET /api/doctor/patients/[patientId]`
- `GET /api/doctor/requests`
- `POST /api/doctor/requests/[requestId]/files`

### 8.2. Etapa de hardening

Agregar políticas RLS para:

- que un médico lea solo sus pacientes vía `patient_doctors`
- que un paciente lea solo sus propios pedidos y recetas
- que las recetas no sean públicas

Hasta que eso exista, no conviene conectar la UI del panel directamente con `.from(...).insert(...)` desde browser.

## 9. Estructura recomendada en el codebase

Para respetar el patrón existente del proyecto:

- UI del panel en nuevas rutas de `app/`
- lógica HTTP en `app/api/doctor/**/route.ts`
- helpers de acceso y validación en `services/` o `lib/`

Ejemplo razonable de crecimiento:

- `app/(doctor)/panel/page.tsx`
- `app/(doctor)/panel/pacientes/page.tsx`
- `app/(doctor)/panel/pacientes/[patientId]/page.tsx`
- `app/(doctor)/panel/pedidos/page.tsx`
- `app/api/doctor/patients/route.ts`
- `app/api/doctor/patients/[patientId]/route.ts`
- `app/api/doctor/requests/route.ts`
- `app/api/doctor/requests/[requestId]/files/route.ts`

Esto mantiene coherencia con el auth actual, que ya vive en `app/api/auth/**`.

## 10. Plan de implementación por fases

## Fase 1. Base de datos

Crear migraciones para:

- alterar `patients`
- crear `patient_medications`
- crear `prescription_requests`
- crear `prescription_files`
- agregar índices, checks, triggers `updated_at`

También crear bucket privado `prescriptions`.

## Fase 2. Backend del panel médico

Implementar handlers para:

- alta de paciente con cuenta real
- listado de pacientes del médico
- detalle de paciente con tratamientos y pedidos
- listado de pedidos del médico
- subida de receta con persistencia en Storage

## Fase 3. Frontend del panel médico

Construir:

- home del panel
- pantalla de pacientes
- formulario “crear nuevo paciente”
- detalle de paciente
- pantalla de pedidos
- acción “subir receta”

## Fase 4. Seguridad fina

Agregar:

- políticas RLS explícitas
- validaciones de tamaño y MIME para recetas
- signed URLs o descarga controlada por backend

## 11. Alcance exacto de esta fase

Sí incluye:

- home del médico post login
- módulo `Pacientes`
- alta de paciente con creación de cuenta
- vínculo automático en `patient_doctors`
- selector de farmacia preferida
- modelo persistente de tratamiento
- módulo `Pedidos`
- listado de pedidos del médico
- subida de receta como archivo o foto
- persistencia de receta vinculada al pedido específico

No incluye todavía:

- interfaz completa del paciente
- automatización de recordatorios
- cálculo automático de agotamiento de medicación
- envío automático de receta a farmacia
- dashboard avanzado de analítica

## 12. Resumen técnico corto

Para este codebase, el panel médico debe desarrollarse como backend-for-frontend sobre `app/api`, usando el admin client de Supabase y no escritura directa desde browser.

Para soportar correctamente los requerimientos nuevos hacen falta:

- ajuste de `patients` para alta de cuenta por médico
- nueva tabla `patient_medications`
- nueva tabla `prescription_requests`
- bucket privado de Storage para recetas
- nueva tabla `prescription_files` vinculada al pedido específico

Sin esas piezas, ni el alta real de pacientes ni el guardado correcto de recetas quedan bien resueltos sobre el esquema actual.
