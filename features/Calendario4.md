Quiero completar el módulo de calendario semanal del paciente en MedFlow permitiendo registrar adherencia.

Contexto:
- Ya existe una UI de calendario semanal con 7 días.
- Cada toma mostrada corresponde a una prescripción + una configuración semanal.
- Ya existe o debe existir una tabla weekly_schedule_logs para guardar el estado de cada toma.
- Quiero que el paciente pueda interactuar con cada medicamento de ese día.

Comportamiento deseado:
Al hacer click sobre una toma del calendario, abrir una acción simple que permita marcar:
- “Lo tomé”
- “No lo tomé”
- “Lo tomé fuera de horario”

Reglas:
1. Si no existe log para esa toma/fecha, crearlo.
2. Si ya existe, actualizarlo.
3. Guardar:
   - prescription_id
   - patient_id
   - scheduled_date
   - scheduled_time si aplica
   - status
   - taken_at cuando corresponda
4. Reflejar el cambio en la UI inmediatamente.
5. Actualizar el color de la toma:
   - taken -> verde
   - late -> naranja
   - missed -> rojo
   - pending -> gris
6. Mantener la UX simple para demo/hackathon.
7. El médico no necesita editar estos logs en esta iteración.
8. Dejar preparado el modelo para que después se pueda calcular adherencia semanal y anomalías.

Implementá:
- endpoint o server action
- persistencia en weekly_schedule_logs
- actualización optimista o refresco de UI
- validación para que el paciente solo pueda editar sus propias tomas
- componentes o modal/dropdown de acción

Importante:
- No cambies la estructura central de prescriptions.
- Los logs deben depender de la prescripción y de la fecha programada.
- Hacer código claro, modular y fácil de extender.