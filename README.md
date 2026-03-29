## MedFlow

MedFlow is a Next.js App Router application for doctor and patient workflows backed by Supabase Auth, Postgres, and Storage.

Current stack:

- `next@16.2.1`
- `react@19.2.4`
- TypeScript
- Tailwind CSS v4
- Supabase (`@supabase/supabase-js`)

## What the app includes

- Public landing and auth screens
- Doctor registration gated by pre-approved DNI
- Login by email or DNI
- Doctor panel for:
  - patient creation
  - treatment creation
  - optional weekly medication schedules
  - prescription request review
  - doctor observations
  - prescription file upload
  - pharmacy workflow updates
- Patient dashboard for:
  - treatment tracking
  - refill requests
  - weekly medication calendar
  - adherence logging
  - notification center

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

## 1. Install dependencies

From the project root:

```bash
npm install
```

## 2. Create the environment file

Create `.env.local` in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CALENDAR_NOTIFICATIONS_CRON_SECRET=choose_a_long_random_secret
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required by browser and server clients.
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side flows such as doctor registration, patient creation, protected data access, notifications, and file uploads.
- `SUPABASE_URL` can be the same value as `NEXT_PUBLIC_SUPABASE_URL`.
- `CALENDAR_NOTIFICATIONS_CRON_SECRET` is required only if you want to call the internal calendar notification endpoint:
  - `POST /api/internal/calendar/notifications`
- If you prefer, the app also accepts `CRON_SECRET` instead of `CALENDAR_NOTIFICATIONS_CRON_SECRET`.

## 3. Set up Supabase

This repository already includes the database definition under `supabase/migrations/` and seed data under `supabase/seed.sql`.

You need a Supabase project with:

- Auth enabled
- Postgres database
- Storage enabled

### Apply the schema

Run the SQL migrations in timestamp order from `supabase/migrations/`:

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

You can do this with the Supabase SQL Editor or your preferred database workflow.

Important:

- Run them in order.
- The migrations create the required private storage bucket `prescriptions`.
- RLS is enabled by the migrations.
- The application currently uses the service-role key for most protected server-side operations.

### Seed base data

After the migrations, execute the contents of `supabase/seed.sql`.

That seed inserts:

- 3 pre-approved doctors in `approved_doctors`
- initial pharmacies in `pharmacies`

It does not create auth users. Doctor auth users are created through the app registration flow.

## 4. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 5. Verify the local setup

After booting the app and loading the seed data, test this flow:

1. Open `/registro-medico`
2. Register a doctor using one of the seeded DNI values:
   - `30111222`
   - `28444555`
   - `32666777`
3. Use any valid email, phone, and password during registration
4. Log in through `/login`
5. Enter the doctor panel and create a patient
6. Create a treatment for that patient
7. Log in as the patient using the credentials created by the doctor

The seeded doctors are also listed in [medicosParaTest.txt](./medicosParaTest.txt).

## Available scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Main project structure

```text
app/                    Next.js routes and API handlers
components/             UI components
services/               Client-side fetch/service layer
lib/                    Business logic, auth, Supabase, notifications, calendar
supabase/migrations/    Database schema history
supabase/seed.sql       Seed data
```

## Required Supabase capabilities

For the project to work properly, your Supabase project must support all of the following:

- Email/password auth
- `auth.users` access through the service-role key
- Postgres functions created by the migrations
- Private storage bucket `prescriptions`
- Service-role access for server-side writes

## Notes and gotchas

- Doctor registration is not an open signup flow. It only works for DNI values already present in `approved_doctors`.
- Patient accounts are created by doctors from the doctor panel.
- Patient activation happens automatically on first authenticated session.
- Prescription file upload currently accepts:
  - `application/pdf`
  - `image/png`
- The refill calculation has a testing override enabled in `lib/patient/medication-calculations.ts`:
  - `FORCE_ENABLE_REFILL_FOR_TESTING = true`
- The internal calendar notification endpoint requires the cron bearer secret configured in `.env.local`.

## Troubleshooting

### Missing Supabase env errors

If you see errors like:

- `Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY`

check `.env.local` and restart the dev server.

### Doctor registration fails

Check:

- the DNI exists in `approved_doctors`
- the migrations were applied in order
- `SUPABASE_SERVICE_ROLE_KEY` is valid
- the doctor was not already claimed

### Protected requests return unauthorized

Check:

- you are logged in through Supabase Auth
- the browser session is valid
- the corresponding `active_doctors` or `patients` row exists

### File upload fails

Check:

- the `prescriptions` bucket exists
- the service-role key is configured
- the file is PNG or PDF
- the file is under 8 MB
