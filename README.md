# DATA LAB AI — Oficina de agentes IA

Oficina virtual 3D en la que 9 agentes de IA (Claude Agent SDK) trabajan en proyectos reales de **Ingeniería de Datos, Ciencia de Datos, Machine Learning y Business Intelligence**. Puedes observarlos, enviarles solicitudes, autorizar sus acciones y revisar los archivos que producen.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Three.js / React Three Fiber · Claude Agent SDK · Supabase (opcional) · Vitest.

## Inicio rápido

```bash
npm install
```

```bash
cp .env.example .env.local   # añade tu ANTHROPIC_API_KEY
```

```bash
npm run dev                  # http://localhost:3000
```

Sin `ANTHROPIC_API_KEY` la oficina se ve y funciona en modo observación, pero **no se simula ningún trabajo**: el panel indica que los agentes no están configurados y no se pueden crear proyectos.

## El equipo

| Agente | Cargo | Herramientas |
|---|---|---|
| Valeria Ríos | CEO: planifica, asigna y supervisa | Read, Glob, Grep (en la revisión) |
| Mateo Fuentes | Ingeniero de Datos | Read, Write, Edit, Glob, Grep, Bash* |
| Lucía Herrera | Arquitecta de Datos | Read, Write, Edit, Glob, Grep |
| Diego Navarro | Científico de Datos | Read, Write, Edit, Glob, Grep, Bash* |
| Sofía Castro | Ingeniera de ML | Read, Write, Edit, Glob, Grep, Bash* |
| Andrés Molina | Analista de Datos | Read, Write, Edit, Glob, Grep, Bash* |
| Camila Ortega | Especialista BI | Read, Write, Edit, Glob, Grep |
| Javier Peña | Auditor de Calidad | Read, Write, Glob, Grep, Bash* |
| Elena Vargas | Investigadora Tecnológica | Read, Write, Glob, Grep, WebSearch, WebFetch |

\* Cada comando de shell requiere tu autorización explícita. Todos tienen además `compartir_hallazgo` y `leer_hallazgos` (servidor MCP en proceso) para colaborar. Las instrucciones de cada agente están en `src/lib/agents/roster.ts` y se pueden ver en el panel (pestaña *Equipo*).

## Cómo trabaja la empresa

1. **Solicitud** → escribes un proyecto en el panel.
2. **Planificación** → la CEO lo divide en 1–8 tareas con responsable y dependencias (salida estructurada validada con zod: responsables válidos, dependencias existentes, sin ciclos).
3. **Reunión de arranque** → los asignados van a la sala de reuniones mientras **tú apruebas o rechazas el plan**. Nada se ejecuta sin esa aprobación.
4. **Ejecución** → los especialistas trabajan respetando dependencias y un límite de concurrencia. Reciben los resultados de las tareas previas y los hallazgos del equipo.
5. **Verificación** → cada agente entrega un informe estructurado; el servidor **comprueba en disco** qué entregables existen realmente (✓/✗ en el panel).
6. **Supervisión** → la CEO abre los entregables, redacta el resumen ejecutivo y lista pendientes. El proyecto solo queda *Completado* si todas las tareas terminaron y la CEO confirma los objetivos.

Los estados visibles (disponible, trabajando, investigando, reunido, bloqueado, finalizado) se derivan de eventos reales del SDK: qué herramienta usa el agente, si espera autorización, si terminó o falló.

## Seguridad y costos

- **Aislamiento:** cada proyecto tiene su carpeta `workspace/<proyecto>/`; las lecturas y escrituras fuera de ella se deniegan, igual que archivos de credenciales (`.env`, `*.pem`, claves SSH…).
- **Autorización humana:** planes y comandos de shell pasan por la cola *Requiere tu autorización*. Comandos peligrosos (`sudo`, leer variables de entorno o secretos, `curl | sh`, `git push`, conexiones remotas, pagos) se bloquean sin preguntar.
- **Credenciales:** las claves solo viven en el servidor. El proceso de cada agente recibe una lista blanca de variables de entorno (no ve `SUPABASE_*` ni `ADMIN_TOKEN`). Define `ADMIN_TOKEN` para exigir un token en todas las acciones si expones el servidor.
- **Costos:** límites por ejecución (`AGENT_MAX_BUDGET_USD`, `AGENT_MAX_TURNS`), concurrencia limitada, esfuerzo configurable (`AGENT_EFFORT`), y solo la investigadora tiene acceso web. El costo estimado que informa el SDK se muestra por tarea y proyecto. Nada se ejecuta sin tu aprobación del plan.
- Los agentes tienen prohibido por instrucción y por política comprar, contratar servicios o crear cuentas.

## Persistencia y memoria

- Por defecto: archivo local `.data/state.json` (sin servicios externos).
- Con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: tablas de `supabase/migrations/001_data_lab_ai.sql` (RLS activado sin políticas públicas; solo el servidor accede).
- **Memoria:** tras cada tarea se guarda una nota por agente; las 5 más recientes se incluyen en sus instrucciones en proyectos futuros.
- Si el servidor se reinicia a mitad de un proyecto, el trabajo pendiente se marca como *interrumpido* (no se inventa su resultado).

## Estructura

```
src/
  app/                 Página y API (state, events SSE, projects, approvals, files)
  components/office/   Escena 3D: minifiguras, mobiliario, salas
  components/panel/    Panel: autorizaciones, proyectos, equipo, actividad
  lib/agents/          Perfiles, instrucciones y herramientas de los 9 agentes
  lib/orchestrator/    Store, orquestador, política de permisos, ejecutor del SDK
  lib/persistence/     Repositorios (archivo, Supabase, memoria)
supabase/migrations/   Esquema SQL
tests/                 Pruebas (Vitest)
```

## Pruebas

```bash
npm test
```

```bash
npm run lint && npm run build
```

Las pruebas del orquestador usan un doble del ejecutor (solo en `tests/`) para verificar sin llamar a la API: flujo completo con dependencias, rechazo del plan, autorización de comandos, propagación de fallos, verificación de entregables en disco y recuperación tras reinicio.

## Variables de entorno

Ver `.env.example`. Las principales: `ANTHROPIC_API_KEY`, `AGENT_MODEL` (por defecto `claude-opus-5-5`), `AGENT_EFFORT` (`medium`), `AGENT_MAX_BUDGET_USD` (`0.50`), `AGENT_MAX_TURNS` (`16`), `AGENT_MAX_CONCURRENCY` (`2`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`.
