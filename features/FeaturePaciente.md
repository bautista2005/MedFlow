Quiero que implementes en la web de MEDIYA el módulo completo inicial de la cuenta del PACIENTE una vez que inicia sesión, manteniendo el mismo stack, arquitectura, diseño general y convenciones ya usadas en el proyecto.

IMPORTANTE:
- No rehagas el proyecto desde cero.
- Extendé lo que ya existe.
- Reutilizá componentes, estilos, sistema de auth, rutas, base de datos y layout actuales.
- La implementación tiene que quedar funcional, consistente visualmente y lista para conectarse con el flujo del médico que ya existe o está en desarrollo.
- Basate visualmente en una UI parecida a las referencias: cards limpias, modernas, con barra de progreso del medicamento y módulo de tracking de pedido tipo app de delivery.
- Adaptar todo a WEB responsive, no a mobile app pura. En desktop no apilar todo en una sola columna si hay espacio suficiente: usar grid responsivo.

========================================
OBJETIVO GENERAL
========================================

Implementar la experiencia del paciente al iniciar sesión en la web, con estas funcionalidades:

1. El paciente, previamente creado por un médico en la base de datos, debe poder iniciar sesión.
2. Una vez logueado, debe ver una pantalla principal con mensaje de bienvenida y una sección "Mis tratamientos".
3. En "Mis tratamientos" deben listarse todos los medicamentos/tratamientos cargados por su médico.
4. Cada medicamento debe mostrarse en una card con:
   - nombre del medicamento
   - dosis
   - frecuencia / cantidad diaria
   - cantidad de unidades por caja
   - fecha de inicio de la caja o tratamiento
   - último pedido si existe
   - días estimados restantes
   - barra de progreso/regresión visual
   - botón "Pedir más"
5. La barra debe ir agotándose en función del tiempo transcurrido desde el inicio de la caja/tratamiento o desde el último pedido confirmado, y cambiar de color:
   - verde: todavía queda tiempo razonable
   - naranja: se está acercando el fin
   - rojo: está por quedarse sin o ya debería haberse quedado sin
6. Al apretar "Pedir más", debe generarse un request de receta dirigido al médico.
7. Luego de generar el pedido, debe aparecer un módulo de tracking visual del estado del pedido, estilo app de comida rápida.
8. El sistema debe impedir pedidos demasiado anticipados, según cálculo de duración del tratamiento.
9. El médico carga el tratamiento; el paciente solo lo ve y puede iniciar el pedido. El paciente no edita el tratamiento.

========================================
CONTEXTO FUNCIONAL QUE DEBE RESPETARSE
========================================

- Los pacientes no se registran libremente.
- El paciente ya fue dado de alta previamente por un médico.
- El médico ya puede tener cargados tratamientos con datos suficientes para calcular cuándo el paciente se queda sin medicación.
- El sistema debe usar esos datos para mostrar el estado actual del medicamento y permitir o bloquear "Pedir más".

========================================
PARTE 1 — LOGIN DEL PACIENTE
========================================

Implementar o completar el login del paciente usando el sistema de autenticación actual del proyecto.

Requisitos:
- El paciente debe poder iniciar sesión con las credenciales ya asociadas a su cuenta.
- Si el login falla, mostrar mensaje claro de credenciales incorrectas.
- Si el login es exitoso, redirigir al dashboard del paciente.
- Verificar que la cuenta autenticada corresponda a un usuario paciente y no a médico.
- Si ya existe una lógica de roles, usarla.
- No duplicar lógica de auth si ya existe: reutilizar.

Ruta sugerida:
- /login o la ruta actual del proyecto
- luego redirección a /patient o /dashboard/patient según convenga al proyecto actual

========================================
PARTE 2 — DASHBOARD PRINCIPAL DEL PACIENTE
========================================

Crear la interfaz principal del paciente.

La pantalla debe incluir:
- mensaje de bienvenida usando su nombre
  Ejemplo: "Hola, Sofía" o "Bienvenida, Sofía"
- subtítulo corto explicando que ahí puede ver sus tratamientos activos y pedir nueva receta cuando corresponda
- sección principal estilo bloque o card grande: "Mis tratamientos"

Diseño responsive:
- en mobile: cards una debajo de la otra
- en tablet/desktop: grid de 2 o más columnas según ancho disponible
- no dejar una sola columna larga si la pantalla es grande
- cards con buena jerarquía visual, padding, bordes suaves, sombras leves y tipografía clara

========================================
PARTE 3 — OBTENER LOS TRATAMIENTOS DEL PACIENTE
========================================

Traer desde base de datos todos los tratamientos activos cargados por el médico para el paciente logueado.

Usar las tablas ya existentes o extenderlas si hace falta. Si no existe un nombre definitivo, contemplar algo como:
- patients
- treatments o prescriptions
- patient_doctors
- prescription_requests / medication_requests
- doctors / active_doctors

Cada tratamiento debe incluir, como mínimo:
- id
- patient_id
- doctor_id
- medication_name
- dose
- unit
- frequency
- frequency_value si aplica
- quantity_per_box
- start_date
- created_at
- updated_at
- is_active
- notes opcional
- last_order_date si existe
- next_estimated_refill_date si existe o calcularla on the fly

Si algunos campos no existen todavía:
- crealos o adaptá el esquema actual de forma prolija
- generá la migración correspondiente
- no rompas datos existentes

========================================
PARTE 4 — CARD DE CADA MEDICAMENTO
========================================

Cada tratamiento/medicamento debe renderizarse en una card visual inspirada en las referencias.

Cada card debe mostrar de forma clara:

Header:
- ícono simple de medicamento / cápsula
- nombre del medicamento, por ejemplo: "Omeprazol 40mg"

Datos visibles:
- dosis
- frecuencia
- cantidad diaria equivalente
- cantidad de unidades por caja
- fecha de inicio de la caja/tratamiento
- último pedido, si existe
- médico asociado, si es útil y ya está disponible

Texto de estado:
- "Te quedan ~X días"
o
- "Te quedan ~X unidades"
pero priorizar días, porque es más entendible para el paciente

Barra de agotamiento:
- una barra horizontal que represente el avance del consumo
- debe comenzar “llena” cuando inicia la caja
- debe ir vaciándose a medida que pasan los días
- debe basarse en cálculo real, no hardcodeado
- debe tener color dinámico:
  - verde: más del 40% restante
  - naranja: entre 15% y 40%
  - rojo: menos del 15%
- si ya se pasó del tiempo estimado, mostrar barra casi vacía o vacía y estado rojo

Botón:
- botón principal "Pedir más"

Estados del botón:
- habilitado si ya corresponde pedir
- deshabilitado si todavía es muy temprano
- si está deshabilitado, agregar mensaje explicativo:
  "Todavía deberías tener medicación disponible. Si necesitás una receta antes de tiempo, consultá a tu médico."

========================================
PARTE 5 — LÓGICA DE CÁLCULO DEL CONSUMO Y DURACIÓN
========================================

Implementar la lógica que determine cuánto debería durar la medicación y cuántos días faltan.

Usar los datos cargados por el médico:
- dosis
- frecuencia
- cantidad por caja
- fecha de inicio del tratamiento o de la caja actual

La lógica debe convertir la frecuencia a una dosis diaria estimada.
Ejemplos:
- 1 por día => 1 diaria
- 2 por día => 2 diarias
- 1 cada 2 días => 0.5 diaria
- 1 por semana => 1/7 diaria

Crear helpers/utilidades claras y reutilizables para:
- calcular dosis diaria efectiva
- calcular duración estimada en días
- calcular días transcurridos desde start_date
- calcular días restantes
- calcular porcentaje restante para la barra
- determinar color/estado visual

Fórmula base:
dias_de_duracion = quantity_per_box / dosis_diaria_efectiva

Luego:
dias_transcurridos = hoy - start_date
dias_restantes = dias_de_duracion - dias_transcurridos

También contemplar:
- si existe un último pedido confirmado más reciente que start_date, usar la fecha más confiable según la lógica del sistema
- si faltan datos críticos, mostrar estado “Información incompleta” en vez de romper la UI

========================================
PARTE 6 — VALIDACIÓN PARA HABILITAR “PEDIR MÁS”
========================================

El botón "Pedir más" NO debe estar siempre habilitado.

Implementar validación temporal para evitar pedidos demasiado anticipados.

Lógica mínima:
- calcular fecha esperada de reposición
- definir una tolerancia razonable, por ejemplo 20% del tiempo total de duración
- si el usuario intenta pedir mucho antes de tiempo, bloquear la acción

Ejemplo:
- si la caja dura 30 días
- tolerancia: 20% => 6 días
- entonces permitir pedido recién cuando falten 6 días o menos, o cuando ya se haya superado la fecha estimada

Condiciones:
- si hoy < fecha_esperada - tolerancia => bloquear pedido
- si hoy >= fecha_esperada - tolerancia => permitir pedido

UI al bloquear:
- botón disabled
- mensaje visible y claro
- no ocultar el botón, solo deshabilitarlo

========================================
PARTE 7 — CREAR PEDIDO DE RECETA
========================================

Cuando el paciente aprieta "Pedir más", crear un request real en la base de datos para que luego lo vea el médico.

Crear o usar una tabla tipo:
prescription_requests / medication_requests

Campos sugeridos:
- id
- patient_id
- doctor_id
- treatment_id
- medication_name
- request_date
- status
- anomaly_score opcional
- anomaly_label opcional
- preferred_pharmacy_id
- selected_pharmacy_id nullable
- rejection_reason nullable
- uploaded_prescription_file_url nullable
- stock_status nullable
- created_at
- updated_at

Estados iniciales del pedido:
- pending_doctor_review
o equivalente claro en inglés y consistente con el proyecto

Al crear el pedido:
- guardar relación con paciente, médico y tratamiento
- evitar duplicados absurdos
- si ya hay un pedido activo para ese mismo tratamiento, no crear otro igual
- mostrar feedback visual inmediato al usuario

========================================
PARTE 8 — TRACKING VISUAL DEL PEDIDO
========================================

Después de que el paciente genera un pedido, mostrar un módulo de tracking estilo delivery / comida rápida, inspirado en la referencia azul que me pasé.

Este tracking debe aparecer:
- dentro de la card del medicamento
o
- como bloque expandido debajo de la card
o
- como card destacada aparte, pero claramente asociada a ese medicamento

Debe mostrar:
- título tipo “Pedido en proceso”
- nombre del medicamento
- estado actual en lenguaje claro
- barra/línea de pasos con nodos
- porcentaje o progreso textual si sirve

Estados sugeridos del flujo:
1. Pedido enviado
2. Esperando respuesta del médico
3. Receta subida
4. Enviando / consultando farmacia
5. Confirmado para retirar

También contemplar estados alternativos:
- blocked_too_early
- no_stock_preferred_pharmacy
- needs_new_consultation
- cancelled

Visualmente:
- estado actual resaltado
- pasos anteriores marcados como completados
- pasos futuros atenuados
- diseño claro y moderno
- componente responsive y legible

Texto dinámico de ejemplo:
- “Pedido enviado”
- “Esperando que tu médico suba la receta”
- “Receta cargada”
- “Consultando stock en farmacia”
- “Listo para retirar”

========================================
PARTE 9 — CASO ESPECIAL SIN STOCK EN FARMACIA PREFERIDA
========================================

Dejar preparado también el estado de falta de stock.

Si el pedido entra en estado:
- no_stock_preferred_pharmacy

Entonces:
- el card de tracking debe cambiar visualmente a error/alerta
- mostrar mensaje en rojo:
  "No hay stock en tu farmacia de preferencia."
- habilitar botón:
  "Ver farmacias cercanas"

Ese botón puede por ahora:
- abrir modal
o
- redirigir a una vista simple
con listado de farmacias cercanas o disponibles según zona

Para esta iteración, aunque el flujo completo de stock todavía sea simple o mockeado, dejá la estructura lista para que luego el paciente pueda seleccionar otra farmacia y continuar el proceso.

========================================
PARTE 10 — INTEGRACIÓN CON EL PANEL DEL MÉDICO
========================================

Asegurate de que el pedido generado por el paciente quede visible para el médico en su sección de pedidos.

No hace falta rehacer el panel del médico entero en esta tarea, pero sí:
- guardar los datos con la forma correcta
- dejar la relación hecha para que el médico pueda ver:
  - paciente
  - medicamento
  - fecha del pedido
  - estado
  - acción para subir receta

Si el sistema del médico ya existe, adaptar el formato del pedido al sistema actual.
Si falta algo menor para conectarlo, implementarlo.

========================================
PARTE 11 — DETALLES DE UX / UI IMPORTANTES
========================================

Quiero una UI prolija, clara y usable para paciente no técnico.

Lineamientos:
- lenguaje simple
- jerarquía visual clara
- no sobrecargar de texto
- cards limpias
- usar colores de estado de manera consistente
- botones grandes y claros
- diseño agradable, más cercano a health-tech moderna que a panel corporativo duro

En la lista de tratamientos:
- evitar tablas frías si las cards funcionan mejor
- usar grid adaptable
- mantener aire visual

En cada card:
- que lo más importante se entienda rápido:
  1. qué medicamento es
  2. cuánto le queda
  3. si puede pedir más o no
  4. en qué estado está el pedido si ya lo hizo

========================================
PARTE 12 — MANEJO DE DATOS FALTANTES Y ERRORES
========================================

No quiero una implementación frágil.

Contemplar:
- paciente sin tratamientos
- tratamiento con datos incompletos
- error al cargar tratamientos
- error al crear pedido
- pedido ya existente
- usuario autenticado sin perfil de paciente válido

Para cada caso:
- mostrar mensaje de UI entendible
- no romper pantalla
- agregar empty states
- ejemplo empty state:
  "Todavía no tenés tratamientos cargados. Consultá con tu médico."

========================================
PARTE 13 — NOTIFICACIONES Y ESTADOS FUTUROS
========================================

Dejá la base preparada para futuras notificaciones:
- cuando falten pocos días de medicación
- cuando haya que pedir nuevo turno médico
- cuando cambie el estado del pedido
- cuando no haya stock
- cuando esté listo para retirar

No hace falta implementar push real completa en esta tarea si el proyecto aún no la tiene, pero sí:
- dejar estructura de estado coherente
- dejar componentes fáciles de extender

========================================
PARTE 14 — COMPONENTES Y ORGANIZACIÓN DEL CÓDIGO
========================================

Separar claramente componentes y lógica.

Sugerencia de componentes:
- PatientDashboard
- TreatmentsSection
- TreatmentCard
- TreatmentProgressBar
- RefillRequestButton
- RequestTrackingCard
- EmptyTreatmentsState
- PharmacySelectionModal si aplica

Helpers / utils:
- calculateDailyDose
- calculateTreatmentDurationDays
- calculateDaysRemaining
- calculateProgressPercentage
- getTreatmentStatusColor
- canRequestRefill
- getRequestTrackingSteps

No meter toda la lógica en un solo componente.

========================================
PARTE 15 — BASE DE DATOS / MIGRACIONES
========================================

Hacé todas las migraciones necesarias para soportar esta funcionalidad de forma limpia.

Necesito:
- tratamientos/prescripciones vinculados a paciente y médico
- requests de reposición/pedido de receta
- estados del pedido
- posibilidad de receta subida más adelante
- farmacia preferida y farmacia seleccionada si corresponde

Si el proyecto ya tiene algunas tablas:
- reutilizalas y extendelas
- no crees duplicados innecesarios

Dejar nombres consistentes y relaciones claras.

========================================
PARTE 16 — DATOS DE PRUEBA / SEED
========================================

Agregar datos de prueba para poder ver la funcionalidad funcionando.

Necesito al menos:
- 1 paciente de prueba logueable
- 1 médico vinculado
- 3 tratamientos cargados con distintos estados:
  - uno en verde
  - uno en naranja
  - uno en rojo o casi agotado
- 1 pedido ya en proceso para que se vea el tracking
- 1 caso de sin stock en farmacia preferida si se puede dejar preparado

========================================
PARTE 17 — CRITERIOS DE ACEPTACIÓN
========================================

La tarea se considera bien hecha si:

1. Un paciente previamente creado puede iniciar sesión.
2. Al entrar, ve un dashboard con saludo y sección “Mis tratamientos”.
3. Se listan sus medicamentos reales desde DB.
4. Cada medicamento aparece en una card prolija con sus detalles.
5. La barra se calcula según duración real del tratamiento.
6. La barra cambia de verde a naranja a rojo según días restantes.
7. El botón “Pedir más” solo se habilita cuando corresponde.
8. Si el paciente pide más, se crea un request en DB.
9. Después del pedido aparece tracking visual del estado.
10. El pedido queda listo para ser visto por el médico.
11. La UI funciona bien en desktop y mobile.
12. No hay hardcodes innecesarios ni lógica frágil.
13. Quedan migraciones, seeds y componentes ordenados.

========================================
PARTE 18 — ENTREGA ESPERADA
========================================

Al finalizar:
- dejá el código implementado
- dejá migraciones y seeds listas
- asegurate de que compile / corra
- corregí errores de tipado/lint si existen
- no dejes TODOs críticos sin resolver
- al final explicame brevemente:
  - qué archivos tocaste
  - qué tablas agregaste o cambiaste
  - cómo probar el flujo del paciente
  - qué credenciales o usuarios seed usar