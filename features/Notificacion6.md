Quiero dejar preparada en MedFlow la capacidad de que, en el futuro, el médico pueda enviar observaciones o mensajes al paciente, y que eso entre al sistema general de notificaciones.

En esta iteración no hace falta una mensajería completa, pero sí quiero preparar la estructura correcta.

Objetivo:
Soportar notificaciones del tipo “observación del médico” dentro del centro general de notificaciones del paciente.

Quiero que implementes:
1. El soporte de category=doctor_message o doctor_observation dentro del sistema notifications
2. Una forma de crear este tipo de notificación desde backend
3. Estructura de metadata para guardar:
   - doctor_id
   - patient_id
   - related_prescription_id opcional
4. UI consistente en el panel de notificaciones
5. Diseño extensible para más adelante convertir esto en:
   - observaciones ligadas a tratamiento
   - observaciones ligadas a una receta
   - o mensajes manuales del médico

Ejemplos de notificaciones futuras:
- “Tu médica dejó una observación sobre este tratamiento”
- “Recordá pedir turno de control antes de renovar la receta”
- “Prestá atención al horario de esta medicación”

Importante:
- No hace falta todavía crear el formulario del médico para escribirlas
- Pero sí dejar el sistema listo para recibirlas sin rediseño posterior
- Todo debe entrar por la misma tabla notifications