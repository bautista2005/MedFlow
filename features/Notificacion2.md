Quiero que implementes la base de datos y backend inicial del sistema general de notificaciones de MedFlow.

Contexto:
- El objetivo es tener un centro unificado de notificaciones para paciente.
- Las notificaciones pueden venir de:
  - calendario semanal
  - flujo de recetas
  - observaciones del médico
  - recordatorios del sistema

Necesito que hagas:
1. Migración SQL para crear tabla notifications
2. Índices razonables
3. Foreign keys correctas hacia paciente/usuario
4. Tipos o enums si son convenientes
5. Funciones server-side o repositorio para:
   - crear notificación
   - listar notificaciones de un paciente
   - marcar una como leída
   - marcar todas como leídas
6. Ordenar por fecha descendente y priorizar unread primero si tiene sentido
7. Soportar metadata opcional en JSON para guardar información relacionada
   - ejemplo: prescription_id
   - ejemplo: weekly_schedule_log_id
   - ejemplo: doctor_note_id futuro
8. Crear código limpio y modular

Requisitos de datos:
La tabla notifications debe soportar al menos:
- id
- patient_id
- category
- type
- title
- message
- status
- priority
- action_url nullable
- metadata json/jsonb nullable
- created_at
- read_at nullable

Ejemplos de category:
- calendar
- prescription
- doctor_message
- system

Ejemplos de type:
- medication_reminder
- weekly_schedule_reminder
- prescription_requested
- prescription_uploaded
- pharmacy_no_stock
- ready_for_pickup
- doctor_observation
- low_medication
- appointment_reminder

Importante:
- No implementar todavía envío por email/push/WhatsApp.
- Solo persistencia + lectura + actualización de estado.
- Tiene que quedar listo para integrarse con UI.