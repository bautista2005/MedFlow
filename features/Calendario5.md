Antes de implementar, hacé un pequeño plan técnico para el módulo “Calendario semanal” de MedFlow.

Necesito que propongas:
1. Qué partes deben reutilizarse de la tabla de prescripciones actual
2. Qué tablas nuevas hacen falta
3. Qué campos NO conviene duplicar
4. Cómo conectar el flujo:
   médico crea tratamiento -> opcionalmente crea calendario -> paciente lo ve -> paciente registra adherencia
5. Qué componentes de UI hacen falta del lado médico y del paciente
6. Qué lógica server-side hace falta para construir la semana
7. Qué partes conviene hacer ahora y cuáles dejar para más adelante
8. Un orden de implementación seguro para no romper lo que ya funciona

Importante:
- Priorizá MVP limpio
- No agregues complejidad innecesaria
- Pensá este módulo como extensión del sistema de prescripciones, no como subsistema aislado
- Quiero una propuesta concreta y accionable, no una explicación genérica