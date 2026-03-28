# Plan técnico adaptado: Calendario semanal

## Estado actual relevado

El codebase ya tiene una primera implementación funcional del módulo:

- El médico ya puede crear un tratamiento con calendario semanal opcional desde `components/mediya/doctor/patient-treatment-form.tsx`.
- La creación persiste tratamiento + calendario en una sola operación vía RPC `create_patient_treatment_with_optional_schedule(...)`.
- El paciente ya puede ver su semana en `components/mediya/patient/patient-weekly-calendar.tsx`.
- El paciente ya puede registrar adherencia en `weekly_schedule_logs` desde `app/api/patient/calendar/logs/route.ts`.
- La construcción server-side de la semana ya existe en `lib/calendar/weekly-calendar.ts`.

En Supabase también existe la base necesaria:

- `patient_medications` como entidad principal del tratamiento/prescripción.
- `weekly_schedule_configs` como extensión 1:1 del tratamiento para el calendario semanal.
- `weekly_schedule_logs` como registro de adherencia por toma.

Conclusión: para el MVP actual no hacen falta tablas nuevas. La feature debe consolidarse como extensión de `patient_medications`, no como subsistema aparte.

## 1. Qué partes deben reutilizarse de la tabla de prescripciones actual

La tabla a reutilizar es `patient_medications`, porque ya representa el tratamiento activo asignado por el médico y ya contiene los datos base que el calendario necesita:

- `patient_medication_id`: debe seguir siendo el ancla principal del calendario.
- `patient_id`: define ownership del calendario y de los logs.
- `active_doctor_id`: define ownership médico y control de acceso.
- `medication_name`: texto principal a mostrar en el calendario.
- `presentation`: dato de apoyo visual para el paciente.
- `dose_text`: descripción legible de la dosis.
- `frequency_text`: descripción legible de la frecuencia.
- `units_per_intake`: sirve para mostrar cantidad por toma.
- `intakes_per_day`: sirve para validar cuántas tomas debe tener el calendario.
- `start_date`: ya define el inicio real del tratamiento.
- `is_active`: debe seguir gobernando si el tratamiento aparece o no.
- `notes`: puede seguir siendo nota clínica del tratamiento, separada de la nota del calendario.

Decisión recomendada:

- `patient_medications` sigue siendo la fuente de verdad del tratamiento.
- `weekly_schedule_configs` solo agrega la capa de programación semanal.
- `weekly_schedule_logs` solo agrega la capa de adherencia.

## 2. Qué tablas nuevas hacen falta

Para este MVP: ninguna.

El esquema actual ya cubre el flujo completo:

- `weekly_schedule_configs`
  - 1 fila por `patient_medication_id`
  - define días, franjas y vigencia del calendario
- `weekly_schedule_logs`
  - 1 fila por toma efectiva (`weekly_schedule_config_id + scheduled_for_date + slot_key`)
  - guarda adherencia real

No conviene agregar:

- una tabla de “eventos semanales materializados”
- una tabla separada de “tomas programadas”
- una tabla separada de “plantillas de horario”

Eso sumaría complejidad, duplicación y problemas de sincronización sin necesidad real en este producto.

## 3. Qué campos NO conviene duplicar

No conviene repetir en `weekly_schedule_configs` ni en `weekly_schedule_logs` los siguientes datos:

- `medication_name`
- `presentation`
- `dose_text`
- `frequency_text`
- `units_per_intake`
- `intakes_per_day`
- `start_date`
- `is_active`
- `preferred_pharmacy_id`

Motivo:

- ya viven en `patient_medications` o en otras entidades del flujo;
- duplicarlos rompería consistencia al editar tratamientos;
- el calendario debe leerlos por join, no copiarlos.

Duplicación aceptable y correcta:

- `patient_id` y `active_doctor_id` en `weekly_schedule_configs` y `weekly_schedule_logs`

Esto sí tiene sentido porque:

- simplifica autorización y consultas;
- evita joins innecesarios en validaciones;
- ya está protegido con triggers de consistencia.

## 4. Cómo conectar el flujo

Flujo recomendado, apoyado en lo que ya existe:

1. Médico crea tratamiento.
2. Si marca “agregar al calendario semanal”, en la misma operación se crea `patient_medications` y `weekly_schedule_configs`.
3. El paciente consulta `/api/patient/calendar`.
4. El server construye la semana combinando:
   - tratamientos activos
   - configuración semanal
   - logs existentes
5. El paciente marca una toma como `taken`, `taken_late` o `missed`.
6. El server hace upsert en `weekly_schedule_logs`.
7. La próxima lectura de la semana refleja el estado real.

Decisión importante:

- El calendario no debe crear “tomas futuras” en base de datos.
- Las tomas se calculan on demand.
- Solo se persiste la adherencia cuando el paciente registra algo.

Eso ya coincide con la implementación actual y es el enfoque correcto para MVP.

## 5. Qué componentes de UI hacen falta del lado médico y del paciente

### Paciente

Ya existe:

- `PatientWeeklyCalendar`
- `PatientWeeklyCalendarDayCard`
- `PatientWeeklyCalendarDoseItem`

Para MVP actual, esto alcanza.

Mejoras recomendadas ahora:

- mostrar con más claridad cuándo una toma está fuera de rango horario pero sigue pendiente;
- mostrar resumen semanal simple:
  - tomas programadas
  - tomadas
  - omitidas
- bloquear visualmente semanas vacías con mensaje más explícito cuando hay tratamientos pero no calendario activo.

Para más adelante:

- filtros por medicamento
- vista mensual
- recordatorios/notificaciones

### Médico

Ya existe:

- formulario de alta con calendario opcional
- resumen simple del calendario en el detalle del paciente

Falta para cerrar el módulo:

- componente de lectura detallada del calendario por tratamiento
- componente de edición del calendario existente
- vista simple de adherencia por paciente/tratamiento

MVP recomendado del lado médico:

- no hacer editor completo todavía;
- agregar una vista de solo lectura más rica en el detalle del paciente;
- dejar edición/cancelación de calendario para una segunda iteración.

## 6. Qué lógica server-side hace falta para construir la semana

La lógica principal ya existe y está bien encaminada en `lib/calendar/weekly-calendar.ts`.

Debe mantenerse este enfoque:

- tomar la semana pedida (`weekStart`);
- resolver lunes-domingo;
- traer tratamientos activos del paciente con join a `weekly_schedule_configs`;
- descartar tratamientos sin calendario o fuera de rango;
- expandir solo los días válidos de esa semana;
- expandir las `intake_slots` de cada día;
- cruzar con `weekly_schedule_logs`;
- devolver estado final por toma:
  - `pending`
  - `taken`
  - `taken_late`
  - `missed`

Validaciones server-side que ya son correctas y conviene preservar:

- el calendario debe pertenecer al paciente autenticado;
- la fecha registrada debe caer dentro del rango configurado;
- el día debe estar habilitado en `days_of_week`;
- `slot_key` debe existir en `intake_slots`;
- la toma se guarda por upsert, no por inserts ciegos.

Lógica server-side que falta o conviene fortalecer:

- endpoint médico de lectura de adherencia por tratamiento o paciente;
- endpoint médico de lectura de calendario detallado sin depender del payload del detalle actual;
- si se agrega edición, una RPC o route handler específica para update de `weekly_schedule_configs`, evitando updates manuales dispersos.

## 7. Qué partes conviene hacer ahora y cuáles dejar para más adelante

### Hacer ahora

- consolidar el MVP sobre el esquema actual;
- mantener `patient_medications` como entidad raíz;
- mantener cálculo on demand de la semana;
- mantener persistencia solo de adherencia real;
- reforzar UI médica de lectura del calendario;
- agregar lectura médica básica de adherencia;
- cubrir edge cases de calendario:
  - tratamiento activo sin calendario
  - calendario sin horarios
  - rango de fechas terminado
  - semana sin ocurrencias

### Dejar para después

- edición completa de calendario ya creado
- historial/versionado de cambios de calendario
- plantillas reutilizables de horarios
- recordatorios push / email / WhatsApp
- reglas avanzadas tipo “día por medio”, “cada X días”, “solo durante N semanas”
- auditoría clínica avanzada con métricas longitudinales

## 8. Orden de implementación seguro para no romper lo que ya funciona

Orden recomendado:

1. No tocar el flujo de recetas (`prescription_requests`, `prescription_files`).
2. Mantener `create_patient_treatment_with_optional_schedule(...)` como punto único de alta.
3. Agregar tests/casos manuales sobre:
   - tratamiento sin calendario
   - tratamiento con calendario
   - adherencia de una toma
   - adherencia repetida sobre la misma toma
4. Agregar lectura médica del calendario/adherencia sin modificar el contrato actual del paciente.
5. Recién después evaluar edición de calendario.
6. Si se implementa edición, hacerlo con endpoint/RPC propio y nunca reescribiendo `patient_medications`.

## Cambios de schema recomendados

Para MVP: ninguno obligatorio.

El schema actual alcanza y está bien modelado para esta feature.

Solo dejaría anotadas dos mejoras técnicas opcionales:

1. Crear una migración de alineación si el estado real de Supabase y los nombres/checks de migraciones locales no coinciden del todo.
2. Si aparece el caso de negocio, agregar en el futuro una tabla o historial de cambios de calendario, pero no ahora.

## Propuesta concreta y accionable

La implementación correcta para este codebase no es “agregar el calendario”, porque el calendario ya existe en nivel base. Lo correcto ahora es cerrar el módulo.

Plan accionable:

1. Tomar `patient_medications` como raíz definitiva del módulo.
2. Mantener `weekly_schedule_configs` y `weekly_schedule_logs` como únicas tablas del calendario.
3. No agregar nuevas tablas para MVP.
4. Completar visibilidad médica del calendario y la adherencia.
5. Mantener el cálculo semanal del lado server.
6. Mantener logs solo para acciones reales del paciente.
7. Postergar edición avanzada, plantillas y recordatorios.

## Resultado final deseado del MVP

Un médico crea un tratamiento y, opcionalmente, le adjunta calendario semanal. El paciente lo ve en su dashboard, registra si tomó o no cada dosis, y el sistema guarda esa adherencia sin duplicar información del tratamiento ni romper el flujo de prescripciones ya existente.
