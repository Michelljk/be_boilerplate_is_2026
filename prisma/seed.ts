import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedH40 } from './seeds/h40.seed.js';
import { seedH4 } from './seeds/h4.seed.js';
import { seedH9 } from './seeds/h9.seed.js';
import { seedH12 } from './seeds/h12.seed.js';
import { seedH22 } from './seeds/h22.seed.js';
import { seedH27 } from './seeds/h27.seed.js';
import { seedAcceptanceFixtures } from './seeds/acceptance.seed.js';

if (process.env.ALLOW_DEMO_SEED !== 'true')
  throw new Error(
    'El seed es solo para pruebas: define ALLOW_DEMO_SEED=true explícitamente.',
  );
const password = process.env.SEED_PASSWORD;
if (
  !password ||
  password.length < 8 ||
  Buffer.byteLength(password, 'utf8') > 72
)
  throw new Error('SEED_PASSWORD debe tener entre 8 y 72 bytes.');
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/El_Salvador',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date());
const part = (key: string) => dateParts.find((p) => p.type === key)!.value;
const today =
  process.env.SEED_DATE ?? `${part('year')}-${part('month')}-${part('day')}`;
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
  !Number.isFinite(new Date(`${today}T00:00:00Z`).getTime()) ||
  new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10) !== today
)
  throw new Error('SEED_DATE inválida.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261108)`;
      const ctx = { prisma: tx, today, passwordHash };
      await seedH40(ctx);
      await seedH4(ctx);
      await seedH9(ctx);
      await seedH12(ctx);
      await seedH22(ctx);
      await seedH27(ctx);
      if (process.env.HTTP_TEST_RUN !== 'true')
        await seedAcceptanceFixtures(ctx);
    },
    { timeout: 60000 },
  );
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@gkds.test' } },
    select: {
      id: true,
      email: true,
      role: true,
      memberProfile: { select: { memberNumber: true } },
    },
    orderBy: { email: 'asc' },
  });
  console.log(JSON.stringify({ seedDate: today, users }, null, 2));
} finally {
  await prisma.$disconnect();
}
