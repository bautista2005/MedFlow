Quiero implementar en MedFlow un sistema general de notificaciones para el paciente, en vez de una columna limitada solo al estado de recetas.

Contexto funcional:
- Ya existe o existirá un flujo de recetas donde el paciente puede pedir medicación y seguir el estado del pedido.
- Ya existe o existirá un calendario semanal donde el paciente puede ver qué medicamentos tomar y registrar adherencia.
- En el futuro, el médico también va a poder enviar observaciones o mensajes al paciente.
- Quiero unificar todo esto en un único centro de notificaciones.

Tipos de notificación que deben contemplarse desde ahora:
1. Recordatorios del calendario semanal
   - ejemplo: “Tomá tu medicación de las 20:00”
2. Estado de recetas / pedidos
   - ejemplo: “Tu pedido fue enviado”
   - ejemplo: “Tu receta fue cargada”
   - ejemplo: “Tu medicación está lista para retirar”
   - ejemplo: “No hay stock en tu farmacia de preferencia”
3. Observaciones del médico
   - ejemplo: “Tu médica te dejó una observación sobre el tratamiento”
4. Sistema / recordatorios generales
   - ejemplo: “Te quedan pocos días de medicación”
   - ejemplo: “Deberías pedir nuevo turno médico”

Quiero que propongas e implementes una arquitectura simple de MVP para esto.

Tareas:
1. Diseñá un modelo de datos general para notificaciones.
2. Priorizá una sola tabla central de notifications, extensible.
3. Definí campos recomendados como:
   - id
   - user_id o patient_id
   - type
   - category
   - title
   - message
   - status (unread/read)
   - priority
   - created_at
   - read_at
   - action_url opcional
   - metadata json/jsonb
4. Explicá qué categorías y tipos conviene definir desde ahora.
5. No hagas todavía envío push real; solo backend + persistencia.
6. El diseño debe soportar crecimiento futuro sin rehacer el sistema.

Importante:
- El paciente va a ver todas estas notificaciones en una sola sección.
- No quiero un sistema separado para recetas y otro para calendario.
- Quiero una propuesta concreta, simple y extensible para hackathon/MVP.