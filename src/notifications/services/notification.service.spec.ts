import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationModule } from '@PrismaClient';
import { NotificationService } from './notification.service.js';

const MEMBER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function setup(overrides: Record<string, unknown> = {}) {
  const repo = {
    findRecipients: vi.fn().mockResolvedValue([MEMBER_A, MEMBER_B]),
    insertMany: vi.fn().mockResolvedValue(2),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    countUnread: vi.fn().mockResolvedValue(4),
    markUnreadAsRead: vi.fn().mockResolvedValue(1),
    owns: vi.fn().mockResolvedValue(true),
    transaction: (work: (client: object) => Promise<unknown>) => work({}),
    ...overrides,
  };
  return { service: new NotificationService(repo as never), repo };
}

const base = {
  memberIds: [MEMBER_A, MEMBER_B],
  module: NotificationModule.RESERVAS,
  title: 'Reserva confirmada',
  message: 'Tu reserva fue confirmada.',
};

describe('NotificationService (H35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza una lista vacía antes de tocar la base de datos', async () => {
    const { service, repo } = setup();
    await expect(
      service.send({ ...base, memberIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  it('rechaza más de 200 destinatarios', async () => {
    const { service } = setup();
    const many = Array.from({ length: 201 }, (_u, i) =>
      `${i.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
    );
    await expect(
      service.send({ ...base, memberIds: many }),
    ).rejects.toMatchObject({
      response: { code: 'NO_RECIPIENTS', field: 'memberIds' },
    });
  });

  it('rechaza un identificador con formato inválido', async () => {
    const { service, repo } = setup();
    await expect(
      service.send({ ...base, memberIds: ['no-es-uuid'] }),
    ).rejects.toMatchObject({ response: { code: 'NO_RECIPIENTS' } });
    expect(repo.findRecipients).not.toHaveBeenCalled();
  });

  it('rechaza un módulo fuera del enum', async () => {
    const { service } = setup();
    await expect(
      service.send({ ...base, module: 'PROMOCIONES' }),
    ).rejects.toMatchObject({ response: { code: 'MODULE_INVALID', field: 'module' } });
  });

  it('rechaza título o mensaje vacíos o demasiado largos', async () => {
    const { service } = setup();
    await expect(
      service.send({ ...base, title: '   ' }),
    ).rejects.toMatchObject({ response: { code: 'TITLE_INVALID' } });
    await expect(
      service.send({ ...base, title: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ response: { code: 'TITLE_INVALID' } });
    await expect(
      service.send({ ...base, message: 'y'.repeat(501) }),
    ).rejects.toMatchObject({ response: { code: 'MESSAGE_INVALID' } });
    await expect(
      service.send({ ...base, dedupeKey: 'k'.repeat(101) }),
    ).rejects.toMatchObject({ response: { code: 'DEDUPE_KEY_INVALID' } });
  });

  it('no crea ninguna notificación si un destinatario no existe', async () => {
    const { service, repo } = setup({
      findRecipients: vi.fn().mockResolvedValue([MEMBER_A]),
    });
    await expect(
      service.send({ ...base, memberIds: [MEMBER_A, MEMBER_C] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  it('deduplica los destinatarios y devuelve creados y omitidos', async () => {
    const { service, repo } = setup({ insertMany: vi.fn().mockResolvedValue(2) });
    const result = await service.send({
      ...base,
      memberIds: [MEMBER_A, MEMBER_B, MEMBER_A],
      dedupeKey: 'RES-CONF-1',
    });
    expect(repo.insertMany).toHaveBeenCalledTimes(1);
    const drafts = repo.insertMany.mock.calls[0][0] as unknown[];
    expect(drafts).toHaveLength(2);
    expect(result).toEqual({ created: 2, skipped: 0 });
  });

  it('cuenta como omitida la fila que el índice único rechazó', async () => {
    const { service } = setup({ insertMany: vi.fn().mockResolvedValue(1) });
    await expect(service.send(base)).resolves.toEqual({
      created: 1,
      skipped: 1,
    });
  });

  it('filtra la bandeja por módulo y por estado sin leer', async () => {
    const { service, repo } = setup();
    await service.list(MEMBER_A, {
      module: NotificationModule.PAGOS,
      unread: true,
      page: 2,
    });
    expect(repo.list).toHaveBeenCalledWith(MEMBER_A, {
      module: 'PAGOS',
      unread: true,
      page: 2,
      pageSize: 20,
    });
  });

  it('rechaza un módulo inválido o una página fuera de rango en la bandeja', async () => {
    const { service, repo } = setup();
    await expect(
      service.list(MEMBER_A, {
      module: 'OTRO' as NotificationModule,
    }),
    ).rejects.toMatchObject({ response: { code: 'MODULE_INVALID' } });
    await expect(service.list(MEMBER_A, { page: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('marca como leída una notificación propia y devuelve 404 si es ajena', async () => {
    const { service } = setup();
    await expect(service.markRead(MEMBER_A, MEMBER_B)).resolves.toEqual({
      success: true,
      alreadyRead: false,
    });

    const already = setup({ markUnreadAsRead: vi.fn().mockResolvedValue(0) });
    await expect(already.service.markRead(MEMBER_A, MEMBER_B)).resolves.toEqual({
      success: true,
      alreadyRead: true,
    });

    const foreign = setup({
      markUnreadAsRead: vi.fn().mockResolvedValue(0),
      owns: vi.fn().mockResolvedValue(false),
    });
    await expect(
      foreign.service.markRead(MEMBER_A, MEMBER_B),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reporta el contador de no leídas', async () => {
    const { service } = setup();
    await expect(service.unreadCount(MEMBER_A)).resolves.toEqual({ count: 4 });
  });
});
