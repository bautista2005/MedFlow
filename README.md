## medflow

medflow es una aplicación Next.js con App Router para flujos de médicos y pacientes, respaldada por Supabase Auth, Postgres y Storage.

Stack actual:

- `next@16.2.1`
- `react@19.2.4`
- TypeScript
- Tailwind CSS v4
- Supabase (`@supabase/supabase-js`)

## Qué incluye la aplicación

- Landing pública y pantallas de autenticación
- Registro de médicos restringido por DNI preaprobado
- Inicio de sesión por email o DNI
- Panel de médico para:
  - creación de pacientes
  - creación de tratamientos
  - horarios semanales opcionales de medicación
  - revisión de solicitudes de receta
  - observaciones médicas
  - carga de archivos de receta
  - actualizaciones del flujo con farmacia
- Panel de paciente para:
  - seguimiento de tratamientos
  - solicitudes de reposición
  - calendario semanal de medicación
  - registro de adherencia
  - centro de notificaciones

## Requisitos previos

- Node.js 20 o superior
- npm
- Un proyecto de Supabase

## 1. Instalar dependencias

Desde la raíz del proyecto:

```bash
npm install
```

## 2. Crear el archivo de entorno

Creá `.env.local` en la raíz del proyecto con:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CALENDAR_NOTIFICATIONS_CRON_SECRET=choose_a_long_random_secret
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son requeridas por los clientes de navegador y servidor.
- `SUPABASE_SERVICE_ROLE_KEY` es requerida para flujos del lado servidor como registro de médicos, creación de pacientes, acceso a datos protegidos, notificaciones y carga de archivos.
- `SUPABASE_URL` puede tener el mismo valor que `NEXT_PUBLIC_SUPABASE_URL`.
- `CALENDAR_NOTIFICATIONS_CRON_SECRET` solo es requerida si querés llamar al endpoint interno de notificaciones del calendario:
  - `POST /api/internal/calendar/notifications`
- Si preferís, la app también acepta `CRON_SECRET` en lugar de `CALENDAR_NOTIFICATIONS_CRON_SECRET`.

## 3. Configurar Supabase

Este repositorio ya incluye la definición de base de datos en `supabase/migrations/` y datos semilla en `supabase/seed.sql`.

Necesitás un proyecto de Supabase con:

- Auth habilitado
- Base de datos Postgres
- Storage habilitado

### Aplicar el esquema

Ejecutá las migraciones SQL en orden cronológico desde `supabase/migrations/`:

1. `20260328120000_initial_mediiya_schema.sql`
2. `20260328121500_enable_rls_and_harden_function.sql`
3. `20260328133000_doctor_registration_claim_flow.sql`
4. `20260328150000_fix_claim_approved_doctor_registration_ambiguity.sql`
5. `20260328170000_panel_medico_v1_schema.sql`
6. `20260328183000_patient_medications_treatment_dates.sql`
7. `20260328193000_patient_medications_box_count.sql`
8. `20260328193000_prescription_requests_acceptance_status.sql`
9. `20260328194500_prescription_request_workflow_notificacion5.sql`
10. `20260328200000_weekly_schedule_calendar.sql`
11. `20260328223000_create_patient_treatment_with_optional_schedule.sql`
12. `20260328233000_weekly_schedule_logs_taken_at.sql`
13. `20260328234500_patient_notifications_mvp.sql`

Podés hacerlo con el SQL Editor de Supabase o con el flujo de base de datos que prefieras.

Importante:

- Ejecutalas en orden.
- Las migraciones crean el bucket privado requerido `prescriptions`.
- RLS queda habilitado por las migraciones.
- La aplicación actualmente usa la service-role key para la mayoría de las operaciones protegidas del lado servidor.

### Cargar datos base

Después de las migraciones, ejecutá el contenido de `supabase/seed.sql`.

Esa seed inserta:

- 3 médicos preaprobados en `approved_doctors`
- farmacias iniciales en `pharmacies`

No crea usuarios de auth. Los usuarios médicos se crean desde el flujo de registro de la aplicación.

## 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Después abrí:

```text
http://localhost:3000
```

## 5. Verificar la configuración local

Después de levantar la app y cargar la seed, probá este flujo:

1. Abrí `/registro-medico`
2. Registrá un médico usando uno de los DNI cargados por seed:
   - `30111222`
   - `28444555`
   - `32666777`
3. Usá cualquier email, teléfono y contraseña válidos durante el registro
4. Iniciá sesión desde `/login`
5. Entrá al panel del médico y creá un paciente
6. Creá un tratamiento para ese paciente
7. Iniciá sesión como paciente con las credenciales creadas por el médico

Los médicos cargados por seed también están listados en [medicosParaTest.txt](./medicosParaTest.txt).

## Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Estructura principal del proyecto

```text
app/                    Rutas de Next.js y handlers de API
components/             Componentes de UI
services/               Capa cliente de fetch/services
lib/                    Lógica de negocio, auth, Supabase, notificaciones, calendario
supabase/migrations/    Historial del esquema de base de datos
supabase/seed.sql       Datos semilla
```

## Capacidades requeridas de Supabase

Para que el proyecto funcione correctamente, tu proyecto de Supabase debe soportar todo lo siguiente:

- Auth con email/password
- acceso a `auth.users` mediante la service-role key
- funciones Postgres creadas por las migraciones
- bucket privado `prescriptions`
- acceso con service-role para escrituras del lado servidor

## Notas y consideraciones

- El registro de médicos no es un signup abierto. Solo funciona para DNI que ya existan en `approved_doctors`.
- Las cuentas de pacientes son creadas por médicos desde el panel médico.
- La activación del paciente ocurre automáticamente en la primera sesión autenticada.
- La carga de archivos de receta actualmente acepta:
  - `application/pdf`
  - `image/png`
- El cálculo de reposición tiene un override de testing habilitado en `lib/patient/medication-calculations.ts`:
  - `FORCE_ENABLE_REFILL_FOR_TESTING = true`
- El endpoint interno de notificaciones del calendario requiere el bearer secret de cron configurado en `.env.local`.

## Solución de problemas

### Errores por variables de entorno de Supabase faltantes

Si ves errores como:

- `Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY`

revisá `.env.local` y reiniciá el servidor de desarrollo.

### Falla el registro de médicos

Verificá:

- que el DNI exista en `approved_doctors`
- que las migraciones se hayan aplicado en orden
- que `SUPABASE_SERVICE_ROLE_KEY` sea válida
- que el médico no haya sido reclamado previamente

### Las requests protegidas devuelven unauthorized

Verificá:

- que hayas iniciado sesión mediante Supabase Auth
- que la sesión del navegador siga siendo válida
- que exista la fila correspondiente en `active_doctors` o `patients`

### Falla la carga de archivos

Verificá:

- que exista el bucket `prescriptions`
- que la service-role key esté configurada
- que el archivo sea PNG o PDF
- que el archivo pese menos de 8 MB
