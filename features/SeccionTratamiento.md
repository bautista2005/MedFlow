🧠 MEDIYA — Iteración: “Agregar tratamiento desde médico”
🎯 Objetivo de esta iteración
Modificar la interfaz actual del médico para:
Que los pacientes no sean solo de visualización
Que cada paciente sea clickeable
Que exista una vista de detalle del paciente
Que desde esa vista el médico pueda:
agregar un tratamiento
Que ese tratamiento:
se guarde en base de datos
quede vinculado al paciente
pueda ser consumido después por la interfaz del paciente

🧩 1. Cambios en la sección “Pacientes”
Estado actual
Lista de pacientes
Solo visualización (no interactiva)

Nuevo comportamiento
🔹 Lista de pacientes (clickable)
Cada paciente debe:
ser un elemento clickeable
redirigir a:
/patients/[patientId]

🔹 Información en la lista (sin cambios grandes)
Se mantiene como “vista rápida”:
Nombre
DNI
Teléfono
Zona
Farmacia
👉 Esto sigue siendo read-only

🧾 2. Nueva pantalla: “Detalle del paciente”
Ruta:
/patients/[patientId]

🔹 Contenido de la pantalla
A. Datos del paciente (read-only)
Sección superior:
Nombre completo
DNI
Email
Teléfono
Zona
Farmacia preferida
👉 estos datos no se editan en esta iteración

B. Nueva sección: “Tratamientos”
Debe incluir:
1. Lista de tratamientos existentes (si hay)
nombre del medicamento
dosis
frecuencia
estado básico (opcional)
👉 solo visualización por ahora

2. Botón principal:
➕ Agregar tratamiento

➕ 3. Flujo: “Agregar tratamiento”
Cuando el médico hace click en:
👉 “Agregar tratamiento”
Se debe abrir:
un modal
 o
una nueva pantalla (/patients/[id]/add-treatment)

🧾 3.1. Formulario de tratamiento
Campos requeridos (mínimos funcionales):
Identificación
Medicamento (string)
 (ej: Isotretinoina 20mg)

Consumo
Dosis
 (ej: 1)
Unidad
 (ej: comprimido, cápsula)
Frecuencia
 (ej: por día / por semana)
👉 importante: esto debe poder convertirse a dosis diaria

Presentación
Cantidad por caja
 (ej: 30 pastillas)

Fecha base (CRÍTICO)
Fecha de inicio del tratamiento
 o
Fecha de inicio de la caja actual
👉 este dato es obligatorio

Opcionales (pero recomendados)
Observaciones
Fecha próxima consulta

🧠 4. Lógica que habilita esto
Este formulario NO es solo UI.
Tiene que permitir después:
👉 calcular esto:
dias_de_duracion = cantidad_por_caja / dosis_diaria
👉 y después:
fecha_fin_estimado = fecha_inicio + dias_de_duracion
👉 esto es lo que después va a usar el paciente

💾 5. Persistencia (MUY importante)
Cuando el médico guarda el tratamiento:
Debe pasar esto:
Se crea un registro en tabla:
 👉 prescriptions (o treatments)

Estructura mínima sugerida
prescriptions
- id
- patient_id (FK)
- doctor_id (FK)
- medication_name
- dose
- unit
- frequency
- quantity_per_box
- start_date
- created_at

Relación clave
patient_id → patients.id
doctor_id → active_doctors.id

🔗 6. Efecto en el sistema
Una vez guardado el tratamiento:
👉 automáticamente:
queda vinculado al paciente
aparece en el detalle del paciente (lado médico)
queda listo para:
FUTURO:
→ ser leído por la interfaz del paciente
→ calcular duración
→ habilitar "Pedir más"

🔄 7. UI después de guardar
Después de crear tratamiento:
volver a /patients/[id]
mostrarlo en lista de tratamientos

⚠️ 8. Importante (alcance)
En esta iteración NO hacemos:
edición de tratamiento
eliminación
cálculo visible en UI
integración con pedidos
validación de anomalías
👉 solo:
 ✔ crear
 ✔ guardar
 ✔ mostrar

🧠 9. Resumen corto para dev
Podés pasar esto:

“Quiero modificar la sección de pacientes dentro del panel de médico para que cada container de paciente sea clickeable y tenga una pantalla de detalle. En esa pantalla, además de mostrar los datos del paciente, debe haber una sección de tratamientos con un botón ‘Agregar tratamiento’. Este botón abre un formulario donde el médico carga medicamento, dosis, frecuencia, cantidad por caja y fecha de inicio. Al guardar, el tratamiento se persiste en la base de datos vinculado al paciente y al médico, y aparece en la lista de tratamientos del paciente. Este dato luego será usado por la interfaz del paciente para calcular cuándo debe pedir medicación entre otras cosas.”
