Quiero integrar el flujo de recetas/pedidos de MedFlow con el nuevo sistema general de notificaciones.

Contexto:
- Ya existe o existirá un flujo donde:
  paciente pide medicación -> médico recibe el pedido -> médico sube receta -> farmacia responde -> listo para retirar
- Antes esto podía mostrarse como un simple estado o columna.
- Ahora quiero que cada cambio importante de estado también genere una notificación general visible en el centro de notificaciones del paciente.

Estados/eventos que deben generar notificación:
1. Pedido enviado
2. Esperando respuesta del médico
3. Receta cargada
4. Consultando farmacia
5. No hay stock en farmacia preferida
6. Elegir farmacia alternativa
7. Confirmado para retirar / listo para retirar

Tareas:
1. Detectar los cambios de estado del pedido
2. Generar una notificación por cada cambio importante
3. Guardar esas notificaciones en la tabla notifications
4. Usar category=prescription
5. Guardar metadata útil:
   - prescription_request_id o request_id
   - patient_id
   - medication_name
   - pharmacy_id si aplica
6. Si existe una pantalla de tracking, cargar action_url hacia esa vista
7. Mantener mensajes claros y amigables para paciente

Ejemplos de mensajes:
- “Tu pedido fue enviado”
- “Tu médica ya cargó la receta”
- “Estamos consultando stock en tu farmacia”
- “No hay stock en tu farmacia de preferencia”
- “Elegí otra farmacia para continuar”
- “Tu medicación está lista para retirar”

Importante:
- No reemplazar el tracking, sino complementarlo.
- El tracking sigue existiendo como vista detallada.
- Las notificaciones deben funcionar como resumen de eventos importantes del flujo.