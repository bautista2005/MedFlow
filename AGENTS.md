<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Current Project State

- This is an existing `MEDIYA` Next.js App Router app, not a greenfield scaffold. Treat the current structure under `app/`, `components/`, `services/`, `lib/`, and `supabase/` as the source of truth.
- The stack in this repo is `next@16.2.1`, `react@19.2.4`, TypeScript, Tailwind CSS v4 via `app/globals.css`, shadcn-style UI primitives via `components/ui/*`, and Supabase via `@supabase/supabase-js`.
- `README.md` is still the default Next scaffold and is not authoritative for product behavior. The real implementation lives in the code and SQL migrations.

# Routing And UI Conventions

- The app already has three route groups with distinct responsibilities:
  - `app/(public)/*` for landing, login, doctor registration, and success/auth entry screens.
  - `app/(doctor)/*` for the authenticated doctor shell and panel pages under `/panel`.
  - `app/(patient)/*` for the authenticated patient shell and dashboard under `/paciente`.
- Shared public-facing presentation is in `components/mediya/*`. Doctor-specific UI lives under `components/mediya/doctor/*`. Patient-specific UI lives under `components/mediya/patient/*`.
- Styles are already established. Reuse the tokens, fonts, gradients, radius scale, and color system defined in `app/globals.css` and the existing `components/ui/*` primitives instead of introducing a parallel styling approach.
- The current visual language uses `Manrope` and `Fraunces`, emerald-based gradients, translucent white cards, rounded radii, and the CSS custom properties declared in `app/globals.css`. Preserve that direction unless a task explicitly asks for a redesign.
- `components.json` is configured for CSS variables and the existing alias scheme (`@/*`). Follow the current import conventions.

# Data And Service Layers

- Client components should generally call the `services/*` layer, not hit Supabase directly:
  - `services/auth/auth-service.ts`
  - `services/doctor/doctor-service.ts`
  - `services/patient/patient-service.ts`
- Shared business types and normalization/validation helpers live in `lib/*`, especially:
  - `lib/auth/*` for authenticated doctor/patient session validation.
  - `lib/doctor/*` for patient/treatment payload types and normalization.
  - `lib/patient/*` for dashboard/request types and medication refill calculations.
  - `lib/supabase/*` for browser, server, and admin Supabase clients.
- Browser-side auth is done with Supabase Auth. Protected API routes expect a bearer token and validate it server-side through `requireAuthenticatedDoctor()` or `requireAuthenticatedPatient()`. Keep that split intact.
- The project currently uses route handlers under `app/api/*` as the backend boundary. Most existing handlers explicitly run on `runtime = "nodejs"`. Match that pattern unless there is a reason to change it.

# Current Product Scope

- The public/auth flow already supports:
  - doctor registration gated by pre-approved DNI
  - login by email or DNI
  - role resolution into doctor vs patient
- The doctor flow already supports:
  - viewing `/panel`
  - listing patients
  - creating patients with temporary passwords
  - assigning a preferred pharmacy
  - creating treatments for a patient
  - listing prescription requests
  - uploading recipe files (`image/*` or `application/pdf`) to Supabase Storage
- The patient flow already supports:
  - authenticated dashboard access
  - viewing assigned treatments
  - refill/request tracking
  - creating new prescription requests from eligible treatments
- Refill eligibility logic is centralized in `lib/patient/medication-calculations.ts`. Do not reimplement that logic in components or route handlers.
- There is currently a testing override in `lib/patient/medication-calculations.ts` (`FORCE_ENABLE_REFILL_FOR_TESTING = true`). Preserve or change that behavior only intentionally.

# Database And Supabase Rules

- The database schema is already substantive. Use the SQL migrations in `supabase/migrations/` as the authoritative schema, not Prisma/Drizzle, inferred models, or outdated documentation.
- Current schema coverage includes:
  - `approved_doctors`
  - `active_doctors`
  - `patients`
  - `patient_doctors`
  - `pharmacies`
  - `patient_medications`
  - `prescription_requests`
  - `prescription_files`
  - update triggers via `public.set_updated_at()`
  - RLS enablement on the existing public tables
  - doctor registration claim flow via `claim_approved_doctor_registration(...)`
  - the private Supabase Storage bucket `prescriptions`
- Patient accounts already distinguish `invited`, `active`, and `disabled` statuses. New work must respect that lifecycle.
- Doctor registration is not a generic signup flow. It depends on `approved_doctors`, creates a Supabase Auth user, then claims the record into `active_doctors` through the SQL RPC.
- Patient creation is also coupled to Supabase Auth plus relational inserts into `patients`, `patient_doctors`, and optionally `patient_medications`. Keep that transactional intent in mind when changing the flow.
- Seed data lives in `supabase/seed.sql`. Keep future schema or data work aligned with the existing migration and seed conventions.

# Environment And Constraints

- Supabase environment access currently depends on:
  - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` for admin/server operations
- Use `lib/env.ts` and the existing Supabase client helpers instead of duplicating env parsing.
- There is no custom `next.config.ts` behavior today. Do not assume image domains, rewrites, or experimental flags exist unless you add them explicitly.
