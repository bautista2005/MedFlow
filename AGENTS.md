<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level behavior. Heed deprecations and do not assume older App Router conventions still apply unchanged.
<!-- END:nextjs-agent-rules -->

# Current Project State

- This is an existing `MEDIYA` Next.js App Router application. Treat the current code under `app/`, `components/`, `services/`, `lib/`, and `supabase/` as authoritative.
- The stack is `next@16.2.1`, `react@19.2.4`, TypeScript, Tailwind CSS v4 via `app/globals.css`, shadcn-style primitives in `components/ui/*`, and Supabase via `@supabase/supabase-js`.
- `README.md` is still scaffold text and is not product documentation.
- `next.config.ts` is effectively empty. Do not assume custom images config, rewrites, headers, or experimental flags.

# Routing Structure

- Root app files:
  - `app/layout.tsx`
  - `app/globals.css`
  - `app/favicon.ico`
- Public route group `app/(public)`:
  - `/` via `app/(public)/page.tsx`
  - `/login` via `app/(public)/login/page.tsx`
  - `/registro-medico` via `app/(public)/registro-medico/page.tsx`
  - `/exito` via `app/(public)/exito/page.tsx`
  - shared public layout in `app/(public)/layout.tsx`
- Doctor route group `app/(doctor)`:
  - authenticated shell layout in `app/(doctor)/layout.tsx`
  - `/panel` via `app/(doctor)/panel/page.tsx`
  - `/panel/pacientes` via `app/(doctor)/panel/pacientes/page.tsx`
  - `/panel/pacientes/[patientId]` via `app/(doctor)/panel/pacientes/[patientId]/page.tsx`
  - `/panel/pedidos` via `app/(doctor)/panel/pedidos/page.tsx`
- Patient route group `app/(patient)`:
  - authenticated shell layout in `app/(patient)/layout.tsx`
  - `/paciente` via `app/(patient)/paciente/page.tsx`
  - `/paciente/notificaciones` via `app/(patient)/paciente/notificaciones/page.tsx`

# API Surface

- Auth routes:
  - `app/api/auth/register-doctor/route.ts`
  - `app/api/auth/resolve-login-identifier/route.ts`
  - `app/api/auth/session-role/route.ts`
- Doctor routes:
  - `app/api/doctor/profile/route.ts`
  - `app/api/doctor/patients/route.ts`
  - `app/api/doctor/patients/[patientId]/route.ts`
  - `app/api/doctor/patients/[patientId]/medications/route.ts`
  - `app/api/doctor/patients/[patientId]/calendar/route.ts`
  - `app/api/doctor/requests/route.ts`
  - `app/api/doctor/requests/[requestId]/note/route.ts`
  - `app/api/doctor/requests/[requestId]/files/route.ts`
  - `app/api/doctor/requests/[requestId]/pharmacy-status/route.ts`
- Patient routes:
  - `app/api/patient/dashboard/route.ts`
  - `app/api/patient/requests/route.ts`
  - `app/api/patient/requests/[requestId]/alternative-pharmacy/route.ts`
  - `app/api/patient/calendar/route.ts`
  - `app/api/patient/calendar/logs/route.ts`
  - `app/api/patient/notifications/route.ts`
  - `app/api/patient/notifications/[notificationId]/route.ts`
  - `app/api/patient/notifications/read-all/route.ts`
- Internal automation route:
  - `app/api/internal/calendar/notifications/route.ts`
- Existing route handlers consistently use `runtime = "nodejs"` and expect bearer-token auth for protected doctor/patient endpoints.

# UI And Component Structure

- Shared public/auth branding lives in `components/mediya/*`:
  - `auth-shell.tsx`
  - `feature-grid.tsx`
  - `logo.tsx`
  - `site-header.tsx`
  - `app-user-menu.tsx`
  - `logout-button.tsx`
- Public forms:
  - `components/mediya/forms/login-form.tsx`
  - `components/mediya/forms/register-doctor-form.tsx`
- Doctor UI lives in `components/mediya/doctor/*`:
  - `doctor-access-guard.tsx`
  - `doctor-shell.tsx`
  - `doctor-dashboard-overview.tsx`
  - `doctor-topbar-profile.tsx`
  - `doctor-logout-button.tsx`
  - `patients-panel.tsx`
  - `patient-detail-panel.tsx`
  - `patient-treatment-form.tsx`
  - `patient-weekly-calendar-panel.tsx`
  - `requests-panel.tsx`
- Patient UI lives in `components/mediya/patient/*`:
  - `patient-access-guard.tsx`
  - `patient-shell.tsx`
  - `patient-dashboard.tsx`
  - `patient-treatment-card.tsx`
  - `patient-request-tracker.tsx`
  - `patient-empty-state.tsx`
  - `patient-topbar-nav.tsx`
  - `patient-topbar-profile.tsx`
  - `patient-notification-center.tsx`
  - `patient-notifications-panel.tsx`
  - `patient-notification-item.tsx`
  - `patient-weekly-calendar.tsx`
  - `patient-weekly-calendar-day.tsx`
  - `patient-weekly-calendar-dose.tsx`
- Reuse the visual system already present in `app/globals.css`: `Manrope`, `Fraunces`, emerald gradients, translucent white cards, rounded radii, and CSS variables.
- Reuse `components/ui/*` primitives and the alias scheme configured in `components.json`.

# Services And Library Boundaries

- Client-side data access should go through:
  - `services/auth/auth-service.ts`
  - `services/doctor/doctor-service.ts`
  - `services/patient/patient-service.ts`
- Supabase clients live in:
  - `lib/supabase/browser.ts`
  - `lib/supabase/server.ts`
  - `lib/supabase/admin.ts`
- Environment helpers live in `lib/env.ts`.
- Auth/session validation lives in:
  - `lib/auth/doctor-session.ts`
  - `lib/auth/patient-session.ts`
- Doctor domain helpers live in:
  - `lib/doctor/types.ts`
  - `lib/doctor/patient-medication.ts`
- Patient domain helpers live in:
  - `lib/patient/types.ts`
  - `lib/patient/medication-calculations.ts`
  - `lib/patient/notifications.ts`
- Weekly calendar and adherence logic live in:
  - `lib/calendar/types.ts`
  - `lib/calendar/utils.ts`
  - `lib/calendar/weekly-calendar.ts`
  - `lib/calendar/logging.ts`
  - `lib/calendar/notifications.ts`
- Keep business logic in `lib/*` or route handlers. Avoid pushing domain rules into components.

# Auth And Access Model

- Browser auth uses Supabase Auth.
- Doctor-protected endpoints validate bearer tokens with `requireAuthenticatedDoctor()`.
- Patient-protected endpoints validate bearer tokens with `requireAuthenticatedPatient()`.
- `requireAuthenticatedPatient()` auto-activates `patients.account_status = 'invited'` to `'active'` on first validated session and stamps `activated_at`.
- Most server mutations and reads currently use the service-role/admin client, even though RLS is enabled on the public tables.

# Current Product Scope

- Public/auth flow supports:
  - doctor registration by approved DNI through `claim_approved_doctor_registration(...)`
  - login by email or DNI lookup
  - session role resolution into doctor or patient
- Doctor flow supports:
  - viewing profile and dashboard shell
  - listing linked patients
  - creating patients with Supabase Auth credentials and temporary password
  - assigning preferred pharmacy during patient creation
  - creating treatments
  - creating treatments with optional weekly medication schedules
  - viewing patient detail including treatments, requests, and weekly adherence calendar
  - listing prescription requests
  - writing doctor observations on requests
  - uploading prescription files to Supabase Storage
  - moving requests through pharmacy workflow states
- Patient flow supports:
  - authenticated dashboard access
  - viewing active and historical treatments
  - seeing refill eligibility calculations per treatment
  - creating prescription requests when allowed
  - choosing an alternative pharmacy when the preferred pharmacy has no stock
  - viewing weekly medication calendar
  - logging doses as `taken`, `missed`, or `taken_late`
  - viewing and marking notifications as read
- Internal automation supports:
  - emitting calendar reminder and pending-dose notifications through `POST /api/internal/calendar/notifications`
  - bearer-token protection via `CALENDAR_NOTIFICATIONS_CRON_SECRET` or `CRON_SECRET`

# Medication, Calendar, And Notification Rules

- Refill eligibility is centralized in `lib/patient/medication-calculations.ts`. Do not duplicate that logic in components or route handlers.
- There is currently an explicit testing override in `lib/patient/medication-calculations.ts`:
  - `FORCE_ENABLE_REFILL_FOR_TESTING = true`
- Treatment creation normalization and validation are centralized in `lib/doctor/patient-medication.ts`.
- Weekly schedule normalization and summary mapping are centralized in `lib/calendar/utils.ts`.
- Calendar log write rules and ownership checks are centralized in `lib/calendar/logging.ts`.
- Patient/system/prescription/calendar notification creation and workflow state transitions are centralized in `lib/patient/notifications.ts`.

# Database And Supabase Structure

- Use `supabase/migrations/*.sql` as the source of truth.
- Use `supabase/seed.sql` for aligned seed conventions.
- Current public tables:
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
- Core table intent:
  - `approved_doctors`: pre-approved doctor registry keyed by DNI and license number, claimable once into an auth account
  - `active_doctors`: doctor accounts linked one-to-one to `auth.users` and `approved_doctors`
  - `pharmacies`: pharmacy catalog with activation and digital-prescription flags
  - `patients`: patient accounts linked one-to-one to `auth.users`, with lifecycle and preferred pharmacy
  - `patient_doctors`: doctor-patient relationship table with `is_primary`
  - `patient_medications`: doctor-authored treatments, refill inputs, and optional follow-up date
  - `prescription_requests`: patient refill/request workflow with preferred and assigned pharmacy
  - `prescription_files`: uploaded current/historical recipe files in the private `prescriptions` bucket
  - `weekly_schedule_configs`: one optional weekly schedule per treatment
  - `weekly_schedule_logs`: per-dose adherence log rows
  - `patient_notifications`: patient inbox entries for prescription, calendar, doctor-message, and system events

# Database Column And Workflow Notes

- `approved_doctors.status` allows:
  - `pending`
  - `approved`
  - `claimed`
  - `rejected`
  - `suspended`
- `patients.account_status` allows:
  - `invited`
  - `active`
  - `disabled`
- `prescription_requests.status` currently allows:
  - `pending`
  - `reviewed`
  - `prescription_uploaded`
  - `pharmacy_checking`
  - `no_stock_preferred`
  - `awaiting_alternative_pharmacy`
  - `ready_for_pickup`
  - `cancelled`
- `weekly_schedule_logs.status` allows:
  - `taken`
  - `missed`
  - `taken_late`
- `weekly_schedule_logs.recorded_by_role` allows:
  - `patient`
  - `doctor`
  - `system`
- `patient_notifications.source` allows:
  - `system`
  - `doctor`
  - `pharmacy`
  - `calendar`
- `patient_notifications.category` allows:
  - `calendar`
  - `prescription`
  - `doctor_message`
  - `system`
- `patient_notifications.status` allows:
  - `unread`
  - `read`
- `patient_notifications.priority` allows:
  - `low`
  - `normal`
  - `high`

# Database Functions, Triggers, And Storage

- Current SQL functions:
  - `public.set_updated_at()`
  - `public.claim_approved_doctor_registration(uuid, text, text, text, text)`
  - `public.is_valid_weekday_array(smallint[])`
  - `public.is_valid_intake_slots_jsonb(jsonb)`
  - `public.enforce_weekly_schedule_config_consistency()`
  - `public.enforce_weekly_schedule_log_consistency()`
  - `public.create_patient_treatment_with_optional_schedule(...)`
- Current trigger coverage:
  - `set_updated_at` triggers on `approved_doctors`, `active_doctors`, `pharmacies`, `patients`, `patient_doctors`, `patient_medications`, `prescription_requests`, `weekly_schedule_configs`, `weekly_schedule_logs`, and `patient_notifications`
  - consistency triggers on `weekly_schedule_configs` and `weekly_schedule_logs`
- Storage:
  - private bucket `prescriptions`
- RLS:
  - enabled on `approved_doctors`
  - enabled on `active_doctors`
  - enabled on `pharmacies`
  - enabled on `patients`
  - enabled on `patient_doctors`
  - enabled on `patient_medications`
  - enabled on `prescription_requests`
  - enabled on `prescription_files`
  - enabled on `weekly_schedule_configs`
  - enabled on `weekly_schedule_logs`
  - enabled on `patient_notifications`
- There are no SQL policies defined in the existing migrations. Server code currently relies on the admin/service-role client for most protected database work.

# Key Database Constraints And Relationships

- `approved_doctors.dni` and `approved_doctors.license_number` are unique.
- `active_doctors.auth_user_id` and `active_doctors.approved_doctor_id` are unique.
- `patients.auth_user_id`, `patients.dni`, and `patients.email` are unique.
- `patient_doctors` enforces unique `(patient_id, active_doctor_id)` and a partial unique primary-doctor index on one `is_primary` row per patient.
- `patient_medications` belongs to one patient and one active doctor.
- `weekly_schedule_configs` has a unique constraint on `patient_medication_id`, so each treatment can have at most one weekly schedule.
- `weekly_schedule_logs` has a unique dose constraint on `(weekly_schedule_config_id, scheduled_for_date, slot_key)`.
- `prescription_files` enforces unique `storage_path` and one current file per request via a partial unique index on `is_current`.
- `patient_notifications` supports deduplication through partial unique index `(patient_id, dedupe_key)` when `dedupe_key` is not null.

# Environment

- Supabase config depends on:
  - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Internal notification automation depends on:
  - `CALENDAR_NOTIFICATIONS_CRON_SECRET` or `CRON_SECRET`
- Use `lib/env.ts` instead of duplicating env parsing.

# Working Rules For Future Changes

- Preserve the existing route-group split between public, doctor, and patient surfaces.
- Prefer editing the existing service and lib layers over bypassing them.
- Respect the patient lifecycle fields and doctor claim flow already encoded in SQL.
- Do not reimplement refill, weekly schedule, calendar logging, or notification workflow logic in UI components.
- When changing schema, add a migration under `supabase/migrations/` and keep seed data aligned.
