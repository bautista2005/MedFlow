Quiero mejorar la experiencia de MedFlow agregando un resumen de notificaciones en la home del paciente.

Contexto:
- Ya existe o existirá un centro completo de notificaciones.
- Además quiero una versión resumida visible desde la pantalla principal del paciente.

Objetivo:
Agregar un bloque resumido de notificaciones recientes y un badge de no leídas.

Requisitos:
1. Mostrar contador de notificaciones no leídas
2. Mostrar badge visual en el acceso a “Notificaciones”
3. En la home del paciente, mostrar preview de las 3 notificaciones más recientes
4. Permitir ir a la pantalla completa de notificaciones
5. Las notificaciones no leídas deben verse destacadas
6. Reutilizar la misma fuente de datos del sistema notifications
7. Mantener diseño responsive y limpio

Implementá:
- query para unread count
- query para recent notifications preview
- badge o indicador visual
- bloque reusable de resumen

Importante:
- No duplicar lógica
- No crear un sistema aparte de previews
- Todo debe salir del mismo modelo de notifications