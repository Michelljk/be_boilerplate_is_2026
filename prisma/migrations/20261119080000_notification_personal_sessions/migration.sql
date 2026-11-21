-- Se conserva el enum y se añade el origen compartido por el módulo de sesiones.
ALTER TYPE "NotificationModule" ADD VALUE IF NOT EXISTS 'SESIONES_PERSONALES';
