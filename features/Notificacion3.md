Quiero implementar en MedFlow una nueva sección general de “Notificaciones” para el paciente.

Objetivo:
Reemplazar el enfoque anterior de una simple columna de estado de recetas por un centro unificado de notificaciones.

Contexto:
- El paciente ya tiene o tendrá una interfaz principal con tratamientos activos.
- También puede tener calendario semanal.
- Ahora quiero una sección visual de notificaciones que centralice:
  - recordatorios del calendario semanal
  - estado de recetas
  - futuras observaciones del médico
  - alertas generales del sistema

Requisitos UI:
1. Crear una sección o pantalla “Notificaciones”
2. Mostrar una lista de notificaciones ordenadas de más nueva a más vieja
3. Cada item debe mostrar:
   - título
   - mensaje
   - fecha/hora
   - estado leída/no leída
   - categoría visual
4. Diferenciar visualmente por categoría:
   - calendario
   - receta
   - mensaje del médico
   - sistema
5. Las no leídas deben destacarse visualmente
6. Permitir marcar una como leída
7. Permitir marcar todas como leídas
8. Si la notificación tiene action_url, el usuario debe poder hacer click y navegar
9. Estado vacío elegante si no hay notificaciones
10. UI responsive para web

Comportamientos esperados:
- Si llega una notificación de calendario: mostrar algo como “Tomá tu medicación”
- Si llega una notificación de receta: mostrar el avance del pedido
- Si llega una observación del médico: mostrarla como mensaje importante
- Si llega una alerta de sistema: mostrarla como recordatorio general

Implementación:
- componente principal NotificationsPanel o similar
- item reusable NotificationCard
- integración con backend existente de notifications
- loading state
- empty state
- actions para mark as read / mark all as read

Importante:
- No inventes un sistema aparte por módulo.
- Todo debe consumir la misma fuente de datos de notifications.
- La UI debe quedar lista para sumar contador de unread más adelante.