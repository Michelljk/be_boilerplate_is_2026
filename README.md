# 🏋️ GKDS — Plataforma de gestión de gimnasio

**Proyecto 2 · Ingeniería de Software · Ciclo 02/2026**  
🎓 Universidad Centroamericana «José Simeón Cañas» (UCA)  
📦 **Repositorio:** Backend (API REST)

![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-success)
[![Architecture diagram of michelljk/be_boilerplate_is_2026](https://gitdiagram.com/michelljk/be_boilerplate_is_2026/diagram.png)](https://gitdiagram.com/michelljk/be_boilerplate_is_2026?utm_source=readme&utm_medium=picture)
[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/michelljk/be_boilerplate_is_2026?utm_source=readme&utm_medium=badge)

## 📖 Descripción

GKDS es una plataforma para administrar las operaciones de un gimnasio y facilitar la interacción entre recepción/administración, entrenadores y miembros. Este repositorio contiene la API del sistema, la lógica de negocio, la autenticación, el acceso a los datos y las migraciones de la base de datos.

El frontend se despliega por separado. La aplicación integra funciones de membresías y planes, cobros y comprobantes, clases grupales y reservas, sesiones personales con entrenadores, rutinas, seguimiento del progreso físico, gestión de máquinas, control de acceso, notificaciones, calificaciones y reportes.

## ✍️ Autores

| Autor | Carrera |
| --- | --- |
| **Gabriel Antonio Urquilla Zetino** | Ingeniería Informática, UCA |
| **Diana Michell Velasquez Meléndez** | Ingeniería Informática, UCA |

## 👥 Equipo de trabajo

> 📝 **Completar los roles y módulos reales de cada integrante antes de la entrega.**

| Integrante | Rol y responsabilidades |
| --- | --- |
| Diana Michell Velasquez Meléndez | [Backend y Coordinación / módulos asignados] |
| Gabriel Antonio Urquilla Zetino | [Backend / módulos asignados] |

## 🔗 Enlaces del proyecto

> ⚠️ **Sustituir los campos pendientes únicamente por URL verificadas del despliegue.**

| Recurso | Enlace |
| --- | --- |
| 🌐 Frontend (Vercel) | **[URL pública del frontend]** |
| ⚙️ Backend (Render) | **[URL base pública del backend]** |
| 📚 Documentación Swagger | **[URL pública del backend]/api/docs** |
| 💻 Repositorio frontend | **[URL del repositorio frontend]** |
| 🗄️ Repositorio backend | https://github.com/Michelljk/be_boilerplate_is_2026 |
| 📋 Tablero del equipo | https://katherineoliva274.atlassian.net/jira/software/projects/GKDS/summary |

> ⏳ **Nota:** en los planes gratuitos el backend se apaga tras un rato sin uso y la primera petición tarda en responder. Abrir el sistema unos minutos antes de cualquier revisión.

> 🔒 **Nota:** el enlace a Swagger debe probarse en Render antes de publicarlo. No almacenar aquí contraseñas de usuarios de prueba, tokens ni variables secretas.

## 🎭 Roles del sistema

El backend contempla los roles `RECEPCION_ADMIN`, `ENTRENADOR` y `MIEMBRO`:

| Rol | Funciones principales |
| --- | --- |
| 🧾 Recepción / Administración | Gestión de planes, membresías, pagos, ingresos, clases y administración operativa, según permisos |
| 🏃 Entrenador | Disponibilidad, agenda, asistencia, rutinas y consulta del progreso de miembros asignados |
| 🙋 Miembro | Consulta de membresía, reservas, pagos, sesiones, rutinas y progreso personal |

El acceso a cada operación está sujeto a autenticación y autorización por rol.

## 🧩 Módulos principales de la API

- 🔐 **Usuarios y autenticación:** identificación, tokens y permisos.
- 💳 **Membresías:** planes, compra, renovación y consulta de vigencia.
- 💵 **Pagos:** cobros, pagos pendientes, historial, anulaciones y comprobantes.
- 👥 **Clases grupales:** programación, disponibilidad, reservas, cancelaciones y asistencia.
- 🧑‍🏫 **Sesiones personales:** horarios del entrenador, reserva, agenda y cancelación.
- 📈 **Entrenamiento y progreso:** rutinas, asignaciones, seguimiento y evolución física.
- 🛠️ **Gestión operativa:** máquinas, mantenimientos y control de acceso.
- 🔔 **Notificaciones, reseñas y reportes:** avisos del sistema, calificaciones e indicadores.

La descripción detallada y el estado de cada historia están documentados en [`docs/08-historias.md`](docs/08-historias.md).

## 🧰 Tecnologías utilizadas

| Componente | Tecnología |
| --- | --- |
| Backend | NestJS 12, TypeScript, Node.js 24 |
| Base de datos | PostgreSQL 18 |
| Acceso a datos y migraciones | Prisma ORM 7 |
| Autenticación | JWT y bcrypt |
| Documentación de endpoints | Swagger / OpenAPI |
| Pruebas | Vitest |
| Entorno local | Docker y Docker Compose |
| Despliegue de backend | Render |
| Despliegue de frontend | Vercel |

## 🚀 Ejecución local del backend

**Requisitos:** Node.js 24.x, npm 11 o superior, Docker y Docker Compose.

1. 📥 Clonar el repositorio y entrar en su directorio.

   ```bash
   # Descarga una copia del repositorio en la computadora
   git clone https://github.com/Michelljk/be_boilerplate_is_2026.git
   # Entra a la carpeta del proyecto recién clonado
   cd be_boilerplate_is_2026
   ```

2. ⚙️ Preparar las variables de entorno:

   ```bash
   # Crea el archivo .env a partir de la plantilla .env.example
   cp .env.example .env
   ```

   Editar `.env` con una `DATABASE_URL` válida y un `JWT_SECRET` aleatorio de al menos 32 caracteres. Si PostgreSQL publica el puerto `5433` en la computadora, la URL de conexión también debe usar `5433`. No publicar `.env` en Git.

3. 🐘 Levantar PostgreSQL e instalar dependencias:

   ```bash
   # Inicia solo el contenedor de PostgreSQL en segundo plano
   docker compose up -d postgres
   # Instala las dependencias exactas definidas en package-lock.json
   npm ci
   ```

4. 🧬 Validar y generar Prisma; aplicar migraciones:

   ```bash
   # Comprueba que el esquema de Prisma no tenga errores
   npx prisma validate
   # Genera el cliente de Prisma para usarlo en el código
   npx prisma generate
   # Aplica las migraciones pendientes a la base de datos
   npx prisma migrate deploy
   ```

5. ▶️ Iniciar la API:

   ```bash
   # Arranca el servidor en modo desarrollo con recarga automática
   npm run start:dev
   ```

6. ✅ Comprobar el servidor:

   ```bash
   # Hace una petición a la API y muestra los encabezados de la respuesta
   curl -i http://localhost:3000/api/v1
   ```

   La documentación de desarrollo se expone en `http://localhost:3000/api/docs`.

### 🌱 Datos de demostración

El proyecto contiene un seed que prepara usuarios de los roles `RECEPCION_ADMIN`, `ENTRENADOR` y `MIEMBRO`, junto con datos de ejemplo. ⚠️ **Solo ejecutarlo en una base desechable de desarrollo o pruebas**. Para habilitarlo se requieren `ALLOW_DEMO_SEED=true` y `SEED_PASSWORD` con una contraseña válida en el `.env` local:

```bash
# Ejecuta el script que crea usuarios de prueba y datos de ejemplo
npm run db:seed
```

🔑 Las credenciales de los usuarios de prueba (un usuario por rol) se entregan exclusivamente en Moodle, no en el repositorio.

## 🧪 Verificaciones técnicas

```bash
# Compila el proyecto para comprobar que no hay errores de TypeScript
npm run build
# Ejecuta toda la suite de pruebas con Vitest
npm test
```

En la verificación local del 20 de noviembre de 2026, el backend compiló correctamente, pasaron **259 pruebas en 48 archivos** y se aplicaron **25 migraciones** sobre una base PostgreSQL nueva. Estos resultados no sustituyen las pruebas de aceptación en producción.

## 📚 Documentación del proyecto

Según el formato de entrega final, este README sirve como portada de la documentación y las páginas detalladas se encuentran en `docs/`.

> 🚧 **Pendiente de completar:** estas páginas enumeradas por la guía no están presentes en la copia de `main` revisada. Crear los archivos antes de dar por terminada la documentación (se pueden tomar de `Plantilla_docs_IS_2026.zip`).

| Documento | Contenido |
| --- | --- |
| [01 — Guía de uso](docs/01-guia-de-uso.md) | Roles, pasos de uso y capturas |
| [02 — Arquitectura](docs/02-arquitectura.md) | Componentes, stack y diagrama de arquitectura |
| [03 — Modelo de datos](docs/03-modelo-de-datos.md) | Diagrama entidad-relación y tablas |
| [04 — API](docs/04-api.md) | Swagger y endpoints por módulo |
| [05 — Instalación local](docs/05-instalacion-local.md) | Configuración, Docker, migraciones, seed y pruebas |
| [06 — Despliegue](docs/06-despliegue.md) | Vercel, Render y variables de entorno sin valores secretos |
| [07 — Forma de trabajo](docs/07-forma-de-trabajo.md) | Ramas, PR, convenciones y tablero |
| [08 — Historias de usuario](docs/08-historias.md) | Responsable, PR, tarjeta y estado de cada historia |
| [09 — Problemas conocidos](docs/09-problemas-conocidos.md) | Problemas pendientes y cómo reproducirlos |

También existe documentación por historia dentro de [`docs/historias/`](docs/historias/), que puede enlazarse desde `docs/08-historias.md`.

## 🌿 Versionado y trabajo colaborativo

El desarrollo de historias se organiza en ramas `feature/<ID>-<descripcion>` con PR a `develop` y revisión de otro integrante. La rama `main` contiene la integración publicada del backend; `release/1.0.0` se creó para preparar la versión final.

### 🏷️ Estado de la versión 1.0.0

- [x] Rama `release/1.0.0` creada desde `develop`
- [ ] PR `release/1.0.0` → `main` aprobado por otro integrante y fusionado
- [ ] `release/1.0.0` regresada a `develop`
- [ ] Etiqueta y release `v1.0.0` publicadas en GitHub sobre `main`

> ℹ️ La existencia de la rama `release/1.0.0` no significa que ya se haya completado el PR de release ni creado la etiqueta `v1.0.0`. Marcar cada casilla cuando se cumpla.

### 🩹 Correcciones después de publicar

Un defecto en producción se corrige con una rama `hotfix/<descripcion>` creada desde `main`, que se fusiona a `main` y a `develop`, y la versión sube a `v1.0.1`.

## 📝 Estado de las historias

El estado de cada historia (terminada o pendiente, con su responsable, tarjeta y PR) se mantiene en [`docs/08-historias.md`](docs/08-historias.md). Las historias pendientes se declaran ahí con su motivo y los problemas conocidos en [`docs/09-problemas-conocidos.md`](docs/09-problemas-conocidos.md).

## 🛡️ Seguridad

- 🚫 No subir `.env`, contraseñas, JWT ni credenciales de la base de datos al repositorio.
- ☁️ Configurar `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` y las demás variables en la plataforma correspondiente; `CORS_ORIGINS` debe incluir la URL del frontend desplegado.
- 📄 El repositorio solo incluye `.env.example` con los nombres de las variables, sin valores secretos.
- 🌱 Mantener `ALLOW_DEMO_SEED=false` en producción, salvo una carga controlada y autorizada de datos de demostración.
- 🔑 No incluir las contraseñas de los usuarios de evaluación en el README.

---

<p align="center">Hecho con 💪 por <b>Gabriel Antonio Urquilla Zetino</b> y <b>Diana Michell Velasquez Meléndez</b> · UCA 2026</p>
