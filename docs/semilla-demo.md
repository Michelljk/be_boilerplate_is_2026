# Datos de demostración y pruebas locales

## Propósito

El seed del backend crea las cuentas de demostración y los datos base. El archivo `prisma/seeds/acceptance.seed.ts` añade escenarios sintéticos para explorar los módulos desde el frontend: membresías, clases, reservas y asistencia, check-ins, sesiones personales con un pago pendiente, rutinas, progreso, una reseña y notificaciones. No se conecta a ningún proveedor de pago ni registra transacciones reales.

## Requisitos de ejecución

El mismo comando (`npm run db:seed`) y el mismo archivo (`prisma/seed.ts`) se utilizan en local y en entornos de demostración o prueba. Variables de entorno:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `ALLOW_DEMO_SEED` | Sí | Debe valer `true`. |
| `SEED_PASSWORD` | Sí | Contraseña de las cuentas de demostración (8 a 72 bytes). |
| `DATABASE_URL` | Sí | Cadena de conexión a la base de datos. |
| `SEED_DATE` | No | Fecha `YYYY-MM-DD` para fijar las fechas de los fixtures. |

Ejecuta el seed únicamente sobre bases de datos de desarrollo o prueba bajo tu control, nunca sobre datos de producción.

```bash
ALLOW_DEMO_SEED=true SEED_PASSWORD="$SEED_PASSWORD" DATABASE_URL="$DATABASE_URL" npm run db:seed
```

### Batería de pruebas HTTP

Con `HTTP_TEST_RUN=true`, el seed omite los fixtures de aceptación. Varias pruebas requieren que las tablas de reservas, check-ins, pagos de sesión, rutinas, progreso, reseñas y notificaciones comiencen vacías.

El comando `npm run test:http` reinicializa la base de datos objetivo, por lo que debe usarse solo con una base desechable que cumpla lo siguiente:

- El nombre de la base termina en `_test`.
- `HTTP_RESET_DATABASE=true`.
- PostgreSQL 18 y Node.js 24.x.

No la utilices con bases que contengan información que quieras conservar.

## Cuentas sintéticas

Las seis cuentas usan la contraseña definida en `SEED_PASSWORD`; el repositorio no incluye ninguna contraseña. Cada ejecución del seed actualiza el hash de contraseña de las cuentas existentes con el valor configurado en ese momento, lo que permite restablecer el acceso sin eliminar perfiles ni registros. Las cuentas del seed deben limitarse a correos con dominio `@gkds.test`.

| Rol | Correo |
| --- | --- |
| Administración (`RECEPCION_ADMIN`) | `admin@gkds.test` |
| Entrenador (`ENTRENADOR`) | `entrenador1@gkds.test` |
| Entrenador (`ENTRENADOR`) | `entrenador2@gkds.test` |
| Miembro (`MIEMBRO`) | `miembro1@gkds.test` |
| Miembro (`MIEMBRO`) | `miembro2@gkds.test` |
| Miembro (`MIEMBRO`) | `miembro3@gkds.test` |

Para la evaluación, los correos y la contraseña configurada en `SEED_PASSWORD` se entregan por Moodle. La contraseña no debe incluirse en el repositorio, en capturas públicas ni en el archivo ZIP.

## Datos incluidos

**Seed base:** salas, plantilla de clase, ejercicios, máquinas (disponibles y en mantenimiento), planes mensual y por clases, membresías vigentes, pagos y recibos iniciales, asignaciones entre entrenadores y miembros, y un registro abierto de mantenimiento.

**Fixtures de aceptación:**

- Un plan trimestral.
- Cuatro sesiones de clase adicionales.
- Cinco reservas de clase, con asistencia histórica y reservas próximas.
- Un check-in por miembro.
- Un pago pendiente vinculado a una sesión personal.
- Rutinas vigentes para los tres miembros.
- Seis registros de progreso.
- Una calificación elegible.
- Tres notificaciones de reserva.

### Cobertura por módulo

El seed principal ejecuta los datos base y, salvo durante la batería HTTP, los fixtures de aceptación. Con ello quedan datos visibles en los diez módulos funcionales y en el módulo compartido de usuarios.

| Módulo | Datos incluidos |
| --- | --- |
| 0. Usuarios, roles y permisos | Una cuenta de recepción/administración, dos entrenadores y tres miembros. |
| 1. Membresías y planes | Planes mensual, por clases y trimestral; membresías vigentes. |
| 2. Clases, sesiones, reservas y asistencia | Plantilla y sesiones de clase; reservas próximas e históricas; asistencia completada para reseñas e informes. |
| 3. Sesiones personales | Horario de entrenador, sesión personal confirmada y pago pendiente asociado. |
| 4. Identificación y control de ingresos | Miembros numerados y un check-in por miembro en la fecha del seed. |
| 5. Cobros, comprobantes e historial | Pagos de membresía con recibo y un pago pendiente de sesión personal. |
| 6. Catálogo de ejercicios y rutinas | Catálogo de ejercicios, rutinas vigentes y dos registros de progreso por miembro. |
| 7. Máquinas y mantenimiento | Máquinas disponibles, en mantenimiento y fuera de servicio; mantenimiento abierto. |
| 8. Evaluaciones y promedios | Una sesión completada con reseña y una asistencia completada elegible para calificar. |
| 9. Notificaciones | Una notificación de reserva por miembro. |
| 10. Reportes y analítica | Reservas, asistencias, pagos, membresías, reseñas, sesiones y asignaciones. |

Los datos de reportes sirven para poblar las vistas y no representan métricas de negocio reales.

### Reproducibilidad

El seed usa claves naturales, `upsert` y búsquedas previas para no duplicar fixtures en ejecuciones sucesivas. Las fechas relativas se calculan a partir de `SEED_DATE` o, si no se define, de la fecha actual en `America/El_Salvador`.

## Verificación local

| Verificación | Resultado |
| --- | --- |
| Batería HTTP | 913/913 aserciones, 801 solicitudes, 101/101 operaciones y rutas cubiertas, 0 respuestas HTTP 500 |
| Pruebas unitarias del backend | 259/259 en 48 archivos |
| Build del backend y build de producción del frontend | Completados |
| Pruebas de navegador | Login correcto para los tres roles; `/api/backend/auth/me` devuelve el rol autenticado; 20 rutas de módulo sin errores HTTP ni de JavaScript |

Las pruebas se ejecutaron sobre un clúster local y desechable de PostgreSQL 18 (`gkds_main_acceptance_test`). No se modificó ni validó Render ni el entorno de producción.

Capturas de evidencia (solo Home): `capturas/home-administracion.png`, `capturas/home-entrenador.png` y `capturas/home-miembro.png`.

## Ejecución local del frontend

El frontend se encuentra en `frontend/` y utiliza el BFF de Next.js (`/api/backend/...`). Configuración para desarrollo local:

- Apuntar `API_URL` a la API local, con el prefijo `/api/v1`.
- Definir `COOKIE_SECURE=false`.
- Configurar `CORS_ORIGINS` con el origen local del frontend, cuando corresponda.
- Mantener `.env.local` fuera de Git y del ZIP.

La API y Next.js deben ejecutarse en puertos libres de tu equipo.