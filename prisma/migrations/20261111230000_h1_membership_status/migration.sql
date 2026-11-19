-- H1 · La etiqueta de estado de la membresía pasa a ser un dato persistido.
--
-- El PDF exige en "Datos (Prisma)" un campo Membership.status con el enum
-- MembershipStatus (VIGENTE/VENCIDA). Hasta ahora el estado sólo se derivaba en
-- lectura, de modo que ningún consumidor (reportes, alertas, consultas de
-- recepción) podía filtrar por él. Esta migración añade la columna, la rellena
-- con la regla canónica y la declara obligatoria; a partir de aquí la mantienen
-- las escrituras de H2 (compra/renovación) y el job diario del dominio.

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('VIGENTE', 'VENCIDA');

-- AddColumn: primero tolerante (sin NOT NULL) para poder rellenar el historial.
ALTER TABLE "memberships" ADD COLUMN "status" "MembershipStatus";

-- Backfill con la regla canónica de elegibilidad: cobro MEMBRESIA PAGADO del mismo
-- miembro, fecha civil del gimnasio (America/El_Salvador) dentro del período y, en
-- los planes POR_CLASES, al menos un crédito restante.
UPDATE "memberships" m
   SET "status" = CASE
         WHEN pay."status" = 'PAGADO'
          AND pay."concept" = 'MEMBRESIA'
          AND pay."member_id" = m."member_id"
          AND m."starts_on" <= (now() AT TIME ZONE 'America/El_Salvador')::date
          AND m."ends_on" >= (now() AT TIME ZONE 'America/El_Salvador')::date
          AND (pl."type" <> 'BY_CLASSES' OR COALESCE(m."credits_remaining", 0) > 0)
         THEN 'VIGENTE'::"MembershipStatus"
         ELSE 'VENCIDA'::"MembershipStatus"
       END
  FROM "membership_plans" pl,
       "payments" pay
 WHERE pl."id" = m."plan_id"
   AND pay."id" = m."payment_id";

-- Ninguna fila puede quedar sin estado: las membresías sin cobro asociado se
-- consideran vencidas y el job diario las revisa igual que a las demás.
UPDATE "memberships"
   SET "status" = 'VENCIDA'::"MembershipStatus"
 WHERE "status" IS NULL;

ALTER TABLE "memberships" ALTER COLUMN "status" SET NOT NULL;

-- Índice parcial para el barrido diario de membresías VIGENTES por vencer.
CREATE INDEX "memberships_status_ends_on_idx"
    ON "memberships"("ends_on")
 WHERE "status" = 'VIGENTE'::"MembershipStatus";
