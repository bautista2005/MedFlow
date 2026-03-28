Quiero extender el flujo actual de “Agregar tratamiento” en el panel del médico de MedFlow.

Contexto:
- Ya existe una pantalla de detalle del paciente.
- Desde ahí el médico puede agregar un tratamiento.
- El tratamiento ya guarda:
  medicamento, dosis, unidad, frecuencia, cantidad por caja, fecha de inicio, observaciones, próxima consulta.
- Ese tratamiento se vincula al paciente y luego aparece en la cuenta del paciente.
- Ahora quiero sumar una opción opcional de calendario semanal asociada al tratamiento.
- Cuando el médico agrega un nuevo medicamento, debe poder elegir si ese tratamiento también se incorpora al calendario semanal.

Objetivo:
Modificar el formulario actual de agregar tratamiento para que incluya una sección opcional:
“Agregar al calendario semanal”

Comportamiento deseado:
1. En el formulario de nuevo tratamiento, agregar un toggle o checkbox:
   - “Agregar este tratamiento al calendario semanal”
2. Si está apagado:
   - se guarda solo la prescripción como hasta ahora
3. Si está encendido:
   - se despliegan campos extra:
     - días de la semana
     - cantidad de veces por día
     - horarios o franjas horarias opcionales
     - notas opcionales
4. Al guardar:
   - se crea la prescripción
   - y además se crea la configuración en weekly_schedule_configs
5. Todo debe persistirse en una misma acción de guardado
6. Si falla una parte, no debe quedar estado inconsistente
7. Usar transacción
8. Luego de guardar, redirigir al detalle del paciente mostrando:
   - el tratamiento en la lista
   - y una indicación visual de si ese tratamiento está incluido en el calendario semanal

Quiero que implementes:
- validación del formulario
- acción server-side / controller
- inserción en base
- manejo de errores
- actualización de la UI del detalle del paciente

Importante:
- No rompas la lógica existente de cálculo de duración y agotamiento.
- Reutilizá los campos existentes de la prescripción.
- No dupliques medication_name, dose, quantity_per_box, etc. dentro del calendario semanal salvo la referencia a prescription_id.
- El resultado tiene que quedar listo para ser leído luego por la interfaz del paciente.    