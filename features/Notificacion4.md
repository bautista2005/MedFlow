Quiero integrar el módulo de calendario semanal de MedFlow con el nuevo sistema general de notificaciones.

Contexto:
- Ya existe o existirá un calendario semanal del paciente con tomas programadas.
- Quiero que el sistema pueda generar notificaciones generales asociadas a esas tomas.
- Estas notificaciones deben entrar en la misma tabla notifications que usa el resto del sistema.

Objetivo:
Cada vez que corresponda una toma o exista una acción relevante del calendario semanal, debe generarse una notificación del tipo calendario.

Casos que deben contemplarse:
1. Recordatorio de toma próxima
   - ejemplo: “Tomá Isotretinoína 20mg a las 20:00”
2. Recordatorio de toma pendiente
   - ejemplo: “Todavía no registraste la toma de hoy”
3. Eventualmente, recordatorio de múltiples tomas no registradas
   - dejar preparado, no necesariamente implementarlo completo

Tareas:
1. Integrar la creación de notificaciones desde el módulo weekly_schedule
2. Crear helpers o servicios para generar notificaciones category=calendar
3. Reutilizar datos de prescriptions para armar título y mensaje
4. Guardar metadata útil:
   - prescription_id
   - scheduled_date
   - scheduled_time
5. Si existe una pantalla relevante, usar action_url para llevar al calendario semanal
6. Evitar duplicados obvios si el sistema corre varias veces para la misma toma
7. Mantener diseño MVP simple

Importante:
- No implementar scheduler real complejo si no hace falta; podés dejar una capa preparada
- Si no existe cron/job real todavía, crear una función clara que después pueda ser invocada por un scheduler
- Todo debe persistirse en notifications, no en una estructura separada