Quiero implementar en MedFlow un módulo opcional de calendario semanal de seguimiento, reutilizando la base de datos existente de prescripciones/tratamientos.

Contexto funcional:
- Ya existe o ya está creada una tabla de prescripciones/tratamientos usada para medicamentos recetados.
- Cada tratamiento ya guarda como mínimo:
  patient_id, doctor_id, medication_name, dose, unit, frequency, quantity_per_box, start_date.
- A partir de esos datos ya se calcula:
  daily_equivalent_dose, estimated_duration_days, estimated_end_date.
- El calendario semanal es opcional y lo configura el médico desde su cuenta.
- Cuando el médico agrega un nuevo medicamento/tratamiento al paciente, debe poder opcionalmente dejarlo incorporado al calendario semanal.
- El calendario semanal luego se muestra en la cuenta del paciente debajo de “Mis tratamientos”.
- El calendario se genera en base a:
  qué medicamentos debe tomar,
  qué días,
  cuántas veces por día,
  y eventualmente en qué horarios o franjas.
- Más adelante el paciente podrá registrar:
  “lo tomé”, “no lo tomé”, “lo tomé fuera de horario”.

Necesito que hagas solo la parte de backend/data model en esta iteración.

Tareas:
1. Revisá el esquema actual y NO dupliques campos ya existentes en prescriptions.
2. Creá las nuevas tablas mínimas necesarias para soportar el calendario semanal:
   - weekly_schedule_configs
   - weekly_schedule_logs
3. weekly_schedule_configs debe quedar vinculada a prescription_id, patient_id y doctor_id.
4. weekly_schedule_logs debe guardar los eventos diarios de adherencia por medicamento/toma.
5. Usá un diseño simple, robusto y extensible para MVP.
6. Agregá índices y foreign keys razonables.
7. Si hace falta, proponé una pequeña extensión a prescriptions, pero priorizá reutilizar lo ya existente.
8. Generá la migración SQL completa.
9. Explicá en comentarios breves por qué elegiste ese diseño.
10. No toques todavía la UI.

Importante:
- El calendario es opcional, así que no todos los tratamientos van a tener configuración semanal.
- Tiene que poder convivir con el flujo actual de cálculo de agotamiento y pedidos.
- El diseño debe servir después para resúmenes semanales, adherencia y detección de anomalías.