# Sistema SST ETINAR — MVP Funcional

Plataforma de gestión documental para contratistas de ETINAR S.A. Este es un
**MVP real y funcional** (no una maqueta): backend NestJS + base de datos +
frontend React, probado de extremo a extremo, incluyendo el motor automático
de cumplimiento, vencimientos, notificaciones y sanciones.

## Qué incluye

- **Autenticación** por roles (Admin, Coordinador SST, Director, Contratista)
- **Proyectos**: al crear uno, se genera automáticamente la estructura de 9
  carpetas documentales estándar (Documentación General, Salud Ocupacional,
  Seguridad Industrial, Gestión Ambiental, Gestión Laboral, Gestión Semanal,
  Gestión Mensual, Evidencias Fotográficas, Cierre del Contrato)
- **Contratistas**: expediente digital, asignación a proyectos, trabajadores
- **Flujo documental completo**: el contratista selecciona proyecto → carpeta
  → tipo documental → carga archivo. El sistema versiona automáticamente
  (nunca sobreescribe ni borra) y registra fecha, hora, usuario y hash SHA-256.
- **Revisión SST**: el coordinador aprueba, observa o rechaza cada documento;
  el sistema notifica el cambio de estado
- **Motor de cumplimiento automático** (`ComplianceEngineService`):
  - Job programado real (`@nestjs/schedule`, corre diariamente a la 1:00 AM)
  - Detecta documentos por vencer en los hitos de 30, 15, 7, 3, 1 y 0 días,
    y documentos ya vencidos (alerta diaria mientras sigan vencidos)
  - Transiciona el estado automáticamente, sin intervención manual:
    `aprobado -> por_vencer -> vencido`
  - Endpoint `POST /api/engine/run-daily-check` para ejecutarlo bajo demanda
    (pruebas, o forzar la revisión sin esperar al job nocturno)
- **Motor de notificaciones**: envía correo real si configuras SMTP
  (variables `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`), o registra el
  correo "simulado" en `notification_log` si no lo configuras — el flujo de
  negocio nunca depende de tener SMTP conectado
- **Reglas de sanción y multas configurables**: desde el panel de
  Administrador, define reglas tipo "si ocurre X, aplica Y" (multa, bloqueo de
  trabajador, bloqueo de empresa, suspensión, denegar ingreso a obra). El
  motor las evalúa y aplica automáticamente, con periodo de gracia opcional.
- **Bloqueo automático**: cuando se cumple una regla, el contratista y/o sus
  trabajadores quedan bloqueados con el motivo visible en el sistema
- **Dashboard ejecutivo**: indicadores de cumplimiento calculados
  automáticamente (nunca manuales) — cumplimiento general, empresas
  bloqueadas, trabajadores habilitados/bloqueados, documentos por
  vencer/vencidos, multas generadas, semáforos verde/amarillo/rojo, ranking
  por contratista
- **Auditoría inmutable**: cada acción del sistema (incluidas las sanciones
  automáticas) queda registrada y no se puede eliminar

## Qué NO incluye (fuera de alcance de un MVP local)

- Infraestructura cloud de producción (AWS/Azure) — corre en SQLite local
- **Integración real con Microsoft 365 / SharePoint**: **el código ya está
  implementado** (`backend/src/sharepoint/`, usando `@azure/msal-node` y
  Microsoft Graph API). Para activarla:
  1. Copia `backend/.env.example` a `backend/.env`
  2. Completa `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
     (de tu app registrada en Azure AD, con permiso de aplicación
     `Sites.ReadWrite.All` en Microsoft Graph y consentimiento de administrador)
  3. Completa `SHAREPOINT_SITE_ID` (el ID del sitio, no la URL — se obtiene
     con `GET https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}`)
  4. Reinicia el backend. Verás en el log
     `"Azure AD configurado — la sincronización con SharePoint está activa"`
  5. Cada documento que se cargue se sincronizará automáticamente con
     SharePoint, respetando la estructura Proyecto/Contratista/Carpeta/Tipo/Año/Mes

  **Importante:** yo no puedo probar esta conexión desde donde desarrollo —
  mi entorno solo tiene salida a registros de paquetes (npm, GitHub), no a
  `login.microsoftonline.com` ni `graph.microsoft.com`. El código sigue el
  flujo estándar de credenciales de cliente de MSAL y está probado en su
  compilación, pero la prueba de conexión real la tienes que hacer tú, en tu
  propia máquina, con tus credenciales.

- **Power BI**: no requiere código adicional de tu parte. Los endpoints
  `/api/dashboard/summary`, `/api/dashboard/by-project` y
  `/api/dashboard/by-contractor` ya devuelven JSON listo para consumir. En
  Power BI Desktop: `Obtener datos → Web`, pega la URL
  (ej. `http://localhost:3001/api/dashboard/by-contractor`), y en
  "Encabezados HTTP" añade `Authorization: Bearer <tu_token>`. Para
  producción, se recomienda exponer estos mismos endpoints detrás de un
  usuario de servicio dedicado en vez de un token personal.
- **Envío real de correo**: la lógica y la bitácora existen; para que se
  envíen de verdad completa las variables `SMTP_*` en `backend/.env`
- **Módulo de IA/OCR real**: requiere una API key (de un servicio de OCR
  cloud o de un modelo de lenguaje). El punto de integración sería el mismo
  `upload()` en `documents.service.ts`, encolando un job de OCR tras guardar
  cada versión (mismo patrón que se usó para SharePoint)
- App móvil nativa

Ver el documento `arquitectura-sst-etinar.md` (entregado antes) para el diseño
completo pensado para producción a esa escala.

## Publicarlo en línea (Render.com, gratis)

Este proyecto incluye `render.yaml` para desplegar backend y frontend con
Render. Pasos:

1. **Sube el código a GitHub** (sin necesidad de instalar Git ni Node):
   - Entra a github.com → "New repository" → nómbralo, por ejemplo, `etinar-sst`
   - En la página del repo vacío, usa "uploading an existing file" y arrastra
     TODAS las carpetas y archivos de este zip (excepto `node_modules` y
     `dist`, que no vienen incluidos de todas formas)
   - Confirma el commit

2. **Conecta Render a GitHub**:
   - Crea una cuenta gratuita en render.com (puedes usar tu cuenta de GitHub
     para registrarte)
   - "New +" → "Blueprint" → selecciona el repositorio `etinar-sst`
   - Render detectará automáticamente el archivo `render.yaml` y propondrá
     crear dos servicios: `etinar-sst-backend` y `etinar-sst-frontend`
   - Dale a "Apply" / "Deploy Blueprint"

3. **Espera el primer despliegue** (unos 3-5 minutos). Cuando termine:
   - Copia la URL pública del backend (algo como
     `https://etinar-sst-backend.onrender.com`)
   - Ve al servicio `etinar-sst-frontend` → "Environment" → edita
     `VITE_API_URL` con esa URL + `/api`
     (ej. `https://etinar-sst-backend.onrender.com/api`)
   - Guarda y espera a que el frontend se vuelva a desplegar automáticamente

4. **Abre la URL del frontend** (algo como
   `https://etinar-sst-frontend.onrender.com`) — ya está en línea, accesible
   desde cualquier dispositivo con internet, sin que tengas que instalar nada.

### ⚠️ Importante sobre el plan gratuito de Render

El plan gratuito usa **almacenamiento efímero**: cada vez que el servicio se
reinicia (se duerme tras 15 minutos sin uso, o cada vez que subes un cambio),
**la base de datos SQLite y los archivos cargados se reinician** a los datos
de demostración originales. Esto es perfecto para que pruebes y muestres el
sistema, pero **no sirve para operación real con datos que deban persistir**.

Para eso, cuando estés listo para producción real, hay que dar el paso que
ya está documentado en `arquitectura-sst-etinar.md`: mover de SQLite a
PostgreSQL (Render ofrece Postgres administrado, con plan gratuito limitado
a 90 días y luego de pago) y el almacenamiento de archivos a S3/Blob Storage
en vez de disco local. Dime cuándo quieras dar ese paso y lo preparamos.

## Requisitos

- Node.js 20 o superior (recomendado 22)
- npm

## Instalación y ejecución

### 1. Backend

```bash
cd backend
npm install
npm run start
```

El backend corre en `http://localhost:3001/api` y crea automáticamente:
- La base de datos SQLite (`backend/etinar-sst.sqlite`)
- Datos de demostración: 1 proyecto, 1 contratista, 4 usuarios

**Usuarios de demostración** (contraseña para todos: `Etinar2026!`):

| Correo | Rol |
|---|---|
| admin@etinar.com | Administrador |
| sst@etinar.com | Coordinador SST |
| director@etinar.com | Director |
| contratista@cmpacifico.ec | Contratista |

**Variables de entorno opcionales** (crea un archivo `backend/.env` si las usas):

```
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=tu_password_o_app_password
SMTP_FROM=sst@etinar.com
JWT_SECRET=cambia-esto-por-un-valor-seguro-en-produccion
```

Sin estas variables, el sistema funciona igual: los correos quedan
registrados como "simulados" en la tabla `notification_log` en vez de
enviarse de verdad.

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

## Flujo sugerido para probar el sistema

1. Entra como **contratista@cmpacifico.ec** -> ve a Proyectos -> abre el
   proyecto de ejemplo -> selecciona la carpeta "Salud Ocupacional" -> carga un
   documento (cualquier archivo) para "Certificado de afiliación IESS",
   poniendo una fecha de vencimiento en el pasado (para ver el motor actuar
   de inmediato en vez de esperar días)
2. Cierra sesión y entra como **sst@etinar.com** -> ve a "Revisión Documental"
   -> aprueba el documento
3. Entra como **admin@etinar.com** -> ve a "Sanciones y Multas" -> crea una
   regla: "Documento vencido" -> "Bloqueo de empresa"
4. Ejecuta el motor manualmente (sin esperar al cron de la 1 AM):
   ```bash
   curl -X POST http://localhost:3001/api/engine/run-daily-check \
     -H "Authorization: Bearer TU_TOKEN_DE_ADMIN"
   ```
5. Ve a "Contratistas" -> verás la empresa bloqueada automáticamente, con el
   motivo visible
6. Ve al Dashboard -> verás los nuevos indicadores actualizados (empresas
   bloqueadas, documentos vencidos, multas)
7. Ve a "Auditoría" -> verás registrada la sanción aplicada automáticamente

## Estructura del proyecto

```
etinar-sst/
├── backend/           # API NestJS + TypeORM + SQLite
│   └── src/
│       ├── entities/            # Modelos de datos
│       ├── auth/                # Login, JWT, roles
│       ├── projects/            # Gestión de proyectos y carpetas
│       ├── contractors/         # Gestión de contratistas
│       ├── documents/           # Motor documental y flujo de revisión
│       ├── dashboard/           # Indicadores e KPIs
│       ├── compliance-engine/   # Motor de cumplimiento (cron + reglas)
│       ├── sanctions/           # Reglas de sanción y multas
│       ├── notifications/       # Envío/registro de correos
│       ├── common/              # Auditoría transversal
│       └── seed/                # Datos de demostración
└── frontend/          # React + Vite + Tailwind
    └── src/
        ├── pages/          # Login, Dashboard, Proyectos, Contratistas,
        │                     Revisión, Sanciones, Auditoría
        ├── components/     # Layout, badges de estado
        └── lib/            # Cliente API, contexto de autenticación
```

## Notas para producción

Antes de usar esto en producción real, como mínimo se debe:

1. Cambiar `JWT_SECRET` (actualmente un valor de desarrollo en
   `backend/src/auth/constants.ts`) por una variable de entorno segura
2. Reemplazar SQLite por PostgreSQL (el diseño ya está pensado para eso, ver
   `arquitectura-sst-etinar.md`)
3. Reemplazar almacenamiento local de archivos (`backend/src/uploads`) por
   S3, Azure Blob Storage o SharePoint (ver nota de integración M365 arriba)
4. Desactivar `synchronize: true` en TypeORM y usar migraciones formales
5. Añadir HTTPS, rate limiting, y un proceso de backups automatizado
6. Configurar SMTP real para que las notificaciones se envíen de verdad
7. Registrar la aplicación en Azure AD si se requiere SSO / SharePoint / Power BI
