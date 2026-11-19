import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const password = 'Demo1234!';
const days = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const member = await prisma.user.upsert({ where: { email: 'miembro@gkds.test' }, update: { role: 'MIEMBRO', memberNumber: 'GKDS-0001', fullName: 'Miembro Demo' }, create: { email: 'miembro@gkds.test', passwordHash: hash, role: 'MIEMBRO', memberNumber: 'GKDS-0001', fullName: 'Miembro Demo' } });
  await prisma.user.upsert({ where: { email: 'entrenador@gkds.test' }, update: { role: 'ENTRENADOR', fullName: 'Entrenador Demo' }, create: { email: 'entrenador@gkds.test', passwordHash: hash, role: 'ENTRENADOR', fullName: 'Entrenador Demo' } });
  await prisma.user.upsert({ where: { email: 'admin@gkds.test' }, update: { role: 'RECEPCION_ADMIN', fullName: 'Recepción Demo' }, create: { email: 'admin@gkds.test', passwordHash: hash, role: 'RECEPCION_ADMIN', fullName: 'Recepción Demo' } });
  const monthly = await prisma.membershipPlan.upsert({ where: { name: 'Plan mensual demo' }, update: {}, create: { name: 'Plan mensual demo', type: 'MONTHLY', priceUsd: 25, durationMonths: 1, benefits: ['Acceso general', 'Clases grupales'], status: 'ACTIVO' } });
  await prisma.membershipPlan.upsert({ where: { name: 'Plan por clases demo' }, update: {}, create: { name: 'Plan por clases demo', type: 'BY_CLASSES', priceUsd: 40, durationDays: 45, classCredits: 10, benefits: ['10 clases'], status: 'ACTIVO' } });
  const membership = await prisma.membership.findFirst({ where: { memberId: member.id } });
  if (!membership) await prisma.membership.create({ data: { memberId: member.id, planId: monthly.id, startsOn: days(-5), endsOn: days(25), status: 'VIGENTE' } });
  const pending = await prisma.payment.findFirst({ where: { memberId: member.id, status: 'PENDIENTE' } });
  if (!pending) await prisma.payment.create({ data: { memberId: member.id, concept: 'SESION_ADICIONAL', amountUsd: 8, dueDate: days(3) } });
  console.log(`Seed listo. Usuarios demo: miembro@gkds.test, entrenador@gkds.test, admin@gkds.test. Contraseña: ${password}`);
}
try { await main(); } finally { await prisma.$disconnect(); }
