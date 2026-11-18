# Documentación Interna ETINAR — guía de activación y uso

Nueva pestaña **Documentación Interna ETINAR** (menú lateral). Sirve para controlar a los asistentes SST, Ambientales, Médicos y de Gestión Social de cada obra, y el cumplimiento documental del **AM MDT-2024-196**, leyendo y escribiendo directamente en las carpetas de OneDrive/SharePoint de cada obra.

## Qué hace el sistema solo (sin intervención)

Todos los días a las 06:30 (hora de Ecuador), y cada vez que pulsas **Sincronizar ahora**:

1. **Lee las carpetas de OneDrive vinculadas** (carpetas y subcarpetas completas). Solo guarda metadatos: nombre, ruta, fechas, autor y enlace. **No copia los archivos ni modifica la estructura.** Si un archivo desaparece de OneDrive, queda marcado como "retirado" (no se borra del historial).
2. **Genera las actividades del período** de cada asistente según su rol y obra (semanales, mensuales, trimestrales…).
3. **Reconoce la evidencia en OneDrive** y calcula el estado de cada actividad:
   - **Ejecutada**: hay evidencia dentro del período (o del plazo de gracia). Si llegó después del plazo, se marca "fuera de plazo".
   - **Pendiente**: el plazo aún no vence.
   - **Incompleta**: hay menos evidencia de la mínima, o la Coordinación SST la observó.
   - **No ejecutada**: el plazo venció sin evidencia → genera alerta.
4. **Evalúa la matriz AM 196** de cada obra: Cumple, Por actualizar, Vencido, Faltante, Observado o No aplica.
5. **Genera y cierra alertas automáticamente**, y envía un correo diario con las alertas nuevas.
6. **Envía los reportes** semanal (martes, sobre la semana lunes–domingo anterior) y mensual (día 6, sobre el mes anterior) a acoque@etinar.com. Nunca envía dos veces el mismo período.

**Cómo se calcula el cumplimiento:** actividades ejecutadas ÷ actividades ya exigibles (ejecutadas + no ejecutadas + incompletas con plazo vencido). Las que aún están en plazo no bajan el porcentaje. En el AM 196: requisitos con evidencia vigente ÷ requisitos aplicables.

## Obligaciones SST (documento "GESTIÓN SST 2026")

El catálogo SST corresponde a las **30 carpetas** del documento "GESTIÓN SST 2026" de ETINAR, con su frecuencia de inspección: anual (cronograma de capacitaciones, plan de contingencia), semestral (matriz de riesgo, simulacros), trimestral (evidencia de capacitaciones de certificados), semanal (certificado de aptitud, ART, permisos de trabajo, baños) y mensual (las demás). Cada obligación se reconoce por el nombre de su carpeta. Por ejemplo, todo lo que esté dentro de "24. PERMISO DE TRABAJOS" cuenta para *Permiso de trabajos*, pero los permisos dentro de "11. SUB-CONTRATISTAS" cuentan solo para *Sub-contratistas*.

Plazos de entrega después del cierre del período: semanal 1 día, mensual 5 días, trimestral 10 días, semestral y anual 15 días. Se cambian en el catálogo.

Las obligaciones de Ambiente, Médico y Social son una propuesta inicial y se ajustan cuando ETINAR defina su lista.

## Cómo reconoce la evidencia

- **Opción precisa (recomendada):** en *Obra → Obligaciones de la obra* indicas la subcarpeta exacta de cada actividad (por ejemplo `SST/CHARLAS DIARIAS`). En la matriz AM 196, abres el requisito e indicas su carpeta.
- **Opción automática:** sin carpeta configurada, el sistema busca por palabras clave en el nombre del archivo y de sus carpetas. Solo busca dentro de la carpeta de la disciplina (SST, AMBIENTE, MÉDICO, SOCIAL), para no mezclar evidencias entre roles. Para el AM 196, si vinculas una carpeta como "Ministerio del Trabajo" o "AM 196", busca solo ahí.
- Las palabras clave se editan en *Reportes y configuración → Catálogo de actividades / Requisitos AM 196*. Usa `,` para alternativas, `+` para exigir varias palabras a la vez (ej. `programa+psicosocial`) y `-` para excluir (ej. `permiso+-contratista`).
- Siempre puedes **vincular a mano** un archivo de OneDrive, o **cargarlo desde el sistema**.

## Carga desde el sistema

El asistente o el coordinador abre la actividad o el requisito, arrastra el archivo y elige la subcarpeta destino. El sistema propone la carpeta donde están las últimas evidencias del mismo tipo.

- El archivo se guarda **en la carpeta original de OneDrive**. Si la subcarpeta no existe, se crea. Si ya existe un archivo con el mismo nombre, OneDrive lo renombra: nunca se sobrescribe nada.
- Se registra quién lo cargó, cuándo y su huella SHA-256.
- Si OneDrive no está disponible en ese momento, el archivo queda guardado temporalmente y se sube solo en la siguiente sincronización. Después se elimina la copia temporal, para no duplicar.

## Roles

| Rol | Puede |
|---|---|
| Administrador / Coordinador SST | Todo: vincular carpetas, registrar y asignar personal, configurar, validar/observar, enviar reportes |
| Director | Ver todo y descargar reportes (solo lectura) |
| **Asistente** (rol nuevo) | Ver solo sus obras y sus actividades, y cargar o vincular evidencias. No accede al resto del sistema (contratistas, sanciones, etc.) |
| Contratista | Sin acceso a este módulo |

Para dar acceso a un asistente: *Personal → Dar acceso*. Se genera una contraseña temporal.

## Activación (una sola vez)

### 1. Desplegar el código
Sube a GitHub el contenido del zip, igual que la vez anterior (reemplaza los archivos). Render vuelve a desplegar solo. Las tablas nuevas (`int_*`) se crean automáticamente en Supabase, y el catálogo inicial (30 actividades y 96 requisitos AM 196) se carga en el primer arranque.

### 2. Conectar Microsoft 365 (lo hace el administrador de TI de ETINAR)
1. Azure Portal → **Microsoft Entra ID → Registros de aplicaciones → Nuevo registro** (nombre: "SST ETINAR").
2. **Permisos de API → Microsoft Graph → Permisos de aplicación**: `Sites.ReadWrite.All`, `Files.ReadWrite.All` y `Mail.Send`. Luego **Conceder consentimiento de administrador**.
3. **Certificados y secretos → Nuevo secreto de cliente**. Copia el *valor*.
4. En Render → `etinar-sst-backend` → **Environment**, agrega:

| Variable | Valor |
|---|---|
| `AZURE_TENANT_ID` | Id. de directorio (inquilino) |
| `AZURE_CLIENT_ID` | Id. de aplicación (cliente) |
| `AZURE_CLIENT_SECRET` | El valor del secreto |
| `MAIL_SENDER` | Buzón desde el que salen los reportes, ej. `sst@etinar.com` |
| `CRON_SECRET` | Ya debería existir (el mismo de `/api/engine/cron-trigger`) |
| `INTERNAL_REPORT_RECIPIENTS` | (opcional) `acoque@etinar.com`; también se cambia desde el panel |

> Las carpetas de ETINAR están en OneDrive personales (`etinar-my.sharepoint.com/personal/...`), así que el permiso **`Files.ReadWrite.All` es imprescindible**. El sistema funciona con enlaces de tipo "Personas de ETINAR": no hace falta compartir con "Cualquier persona".
>
> Si prefieres restringir el acceso a un solo sitio de SharePoint en lugar de todo el tenant, se puede usar `Sites.Selected`. Requiere un paso adicional de TI; pídemelo y lo ajusto.

### 3. Programar el disparador diario (Render gratuito se duerme)
En cron-job.org (o el servicio que ya usan), crea un trabajo diario a las **06:30 (America/Guayaquil)**:
```
POST https://etinar-sst-backend.onrender.com/api/internal/cron-trigger?secret=TU_CRON_SECRET
```
Este disparador lee OneDrive, evalúa todo, envía las alertas y, cuando corresponde, los reportes semanal y mensual.

### 4. Cargar las obras
1. *Documentación Interna → Obras → Agregar obra al seguimiento*.
2. **Carpetas OneDrive → Vincular carpeta**: en SharePoint, clic derecho sobre la carpeta de la obra → **Copiar vínculo** → pegarlo. Vincula la carpeta general de la obra y, por separado, la del **Ministerio del Trabajo / AM 196** y la de **Seguridad y Salud**, cada una con su "uso".
3. **Personal → Registrar persona** y asignarla a la obra con su fecha de inicio. El sistema reconstruye hasta 8 semanas de historial con lo que ya existe en OneDrive.
4. (Recomendado) **Obligaciones de la obra**: ajusta las subcarpetas exactas y desactiva lo que no aplique.

## Pruebas realizadas

Las pruebas usaron PostgreSQL 16 y un servidor que simula Microsoft Graph con una estructura de obra realista: carpetas SST, AMBIENTE, MÉDICO y Ministerio, con archivos de distintas fechas. Se verificó lo siguiente:

- Vinculación por enlace y error claro con un enlace inválido.
- Lectura recursiva con paginación.
- Estados de actividades semana a semana y del AM 196 (incluidos vencidos y por actualizar).
- Carga con tildes y eñes, sin sobrescribir (`Permiso.pdf` → `Permiso 1.pdf`), y creación de subcarpetas.
- Carga cuando OneDrive falla: queda pendiente, se sube luego y se elimina la copia temporal.
- Observar, nueva evidencia y vuelta a evaluación; validar y no aplica.
- Archivo borrado en OneDrive: se marca retirado y la actividad pasa a "no ejecutada".
- Correos de alertas, reporte semanal (con Excel) y mensual (con Excel y PDF), sin duplicados.
- Rol asistente limitado a sus obras, con 403 en el resto del sistema.
- Contratista sin acceso al módulo.
- Los flujos existentes de contratistas y el motor de cumplimiento siguen funcionando.

**Pendiente de tu lado:** la conexión real con el tenant de ETINAR. Desde mi entorno no se puede llegar a `login.microsoftonline.com` ni a `graph.microsoft.com`. El código usa el flujo estándar de credenciales de cliente de Microsoft y los endpoints oficiales de Graph (`/shares`, `/drives/{id}/items`, `createUploadSession`, `sendMail`). La primera prueba real se hace al vincular la primera carpeta: si hay un problema de permisos, el sistema muestra el mensaje exacto de Microsoft.

## Notas sobre el AM 196

La matriz se construyó con los requisitos del **Anexo 1 (Lista de verificación SST)** del AM MDT-2024-196, en texto resumido, con 96 ítems en 5 secciones. Las **vigencias** (anual, trimestral, mensual para verificaciones en campo) son un control interno sugerido para alertar a tiempo; no son plazos legales. Antes de una auditoría, revisa la redacción contra la versión oficial vigente del Ministerio del Trabajo. Todo es editable desde el panel.
