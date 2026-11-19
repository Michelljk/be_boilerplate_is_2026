import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationModule } from '@PrismaClient';
import {
  NotificationService,
  NotificationValidationError,
} from './notification.service.js';

const MEMBER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function setup(overrides: Record<string, unknown> = {}) {
  const repo = {
    findRecipients: vi.fn().mockResolvedValue([MEMBER_A, MEMBER_B]),
    insertMany: vi.fn().mockResolvedValue({
      created: 2,
      ids: ['notification-a', 'notification-b'],
    }),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    countUnread: vi.fn().mockResolvedValue(4),
    markUnreadAsRead: vi.fn().mockResolvedValue(1),
    owns: vi.fn().mockResolvedValue(true),
    transaction: vi.fn((work: (client: object) => Promise<unknown>) =>
      work({}),
    ),
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

  it('rechaza una lista vacía antes de tocar la base de datos con el error contractual', async () => {
    const { service, repo } = setup();
    await expect(
      service.send({ ...base, memberIds: [] }),
    ).rejects.toMatchObject({
      code: 'NO_RECIPIENTS',
      field: 'memberIds',
      message: expect.any(String),
    });
    await expect(
      service.send({ ...base, memberIds: [] }),
    ).rejects.toBeInstanceOf(NotificationValidationError);
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  it('rechaza más de 200 destinatarios', async () => {
    const { service } = setup();
    const many = Array.from(
      { length: 201 },
      (_u, i) =>
        `${i.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
    );
    await expect(
      service.send({ ...base, memberIds: many }),
    ).rejects.toMatchObject({
      code: 'NO_RECIPIENTS',
      field: 'memberIds',
    });
  });

  it('rechaza un identificador con formato inválido', async () => {
    const { service, repo } = setup();
    await expect(
      service.send({ ...base, memberIds: ['no-es-uuid'] }),
    ).rejects.toMatchObject({ code: 'NO_RECIPIENTS', field: 'memberIds' });
    expect(repo.findRecipients).not.toHaveBeenCalled();
  });

  it('rechaza un módulo fuera del enum', async () => {
    const { service } = setup();
    await expect(
      service.send({ ...base, module: 'PROMOCIONES' as NotificationModule }),
    ).rejects.toMatchObject({
      code: 'MODULE_INVALID',
      field: 'module',
      message: expect.any(String),
    });
  });

  it('rechaza título o mensaje vacíos o demasiado largos', async () => {
    const { service } = setup();
    await expect(service.send({ ...base, title: '   ' })).rejects.toMatchObject(
      { code: 'TITLE_INVALID', field: 'title' },
    );
    await expect(
      service.send({ ...base, title: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'TITLE_INVALID', field: 'title' });
    await expect(
      service.send({ ...base, message: 'y'.repeat(501) }),
    ).rejects.toMatchObject({ code: 'MESSAGE_INVALID', field: 'message' });
    await expect(
      service.send({ ...base, dedupeKey: 'k'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'DEDUPE_KEY_INVALID', field: 'dedupeKey' });
  });

  it('usa UNKNOWN_RECIPIENT y no crea nada si un miembro no existe', async () => {
    const { service, repo } = setup({
      findRecipients: vi.fn().mockResolvedValue([MEMBER_A]),
    });
    const rejection = service.send({
      ...base,
      memberIds: [MEMBER_A, MEMBER_C],
    });
    await expect(rejection).rejects.toBeInstanceOf(NotificationValidationError);
    await expect(rejection).rejects.toMatchObject({
      code: 'UNKNOWN_RECIPIENT',
      field: 'memberIds',
      message: expect.any(String),
    });
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  it('valida destinatarios e inserta dentro de la misma transacción cuando no recibe tx', async () => {
    const { service, repo } = setup();
    await service.send(base);
    const tx = repo.transaction.mock.results[0]?.value;
    expect(repo.transaction).toHaveBeenCalledTimes(1);
    expect(repo.findRecipients).toHaveBeenCalledWith(
      [MEMBER_A, MEMBER_B],
      expect.anything(),
    );
    expect(repo.insertMany).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
    );
    expect(tx).toBeDefined();
  });

  it('usa el tx del módulo llamador sin abrir una transacción paralela', async () => {
    const { service, repo } = setup();
    const tx = {};
    await service.send(base, tx as never);
    expect(repo.transaction).not.toHaveBeenCalled();
    expect(repo.findRecipients).toHaveBeenCalledWith([MEMBER_A, MEMBER_B], tx);
    expect(repo.insertMany).toHaveBeenCalledWith(expect.any(Array), tx);
  });

  it('deduplica destinatarios y devuelve creados, omitidos e ids', async () => {
    const { service, repo } = setup({
      insertMany: vi.fn().mockResolvedValue({
        created: 2,
        ids: ['notification-a', 'notification-b'],
      }),
    });
    const result = await service.send({
      ...base,
      memberIds: [MEMBER_A, MEMBER_B, MEMBER_A],
      dedupeKey: 'RES-CONF-1',
    });
    expect(repo.insertMany).toHaveBeenCalledTimes(1);
    const drafts = repo.insertMany.mock.calls[0][0] as unknown[];
    expect(drafts).toHaveLength(2);
    expect(result).toEqual({
      created: 2,
      skipped: 0,
      ids: ['notification-a', 'notification-b'],
    });
  });

  it('cuenta como omitida la fila que el índice único rechazó y sólo devuelve ids creados', async () => {
    const { service } = setup({
      insertMany: vi.fn().mockResolvedValue({
        created: 1,
        ids: ['notification-a'],
      }),
    });
    await expect(service.send(base)).resolves.toEqual({
      created: 1,
      skipped: 1,
      ids: ['notification-a'],
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
      service.list(MEMBER_A, { module: 'OTRO' as NotificationModule }),
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
    await expect(already.service.markRead(MEMBER_A, MEMBER_B)).resolves.toEqual(
      {
        success: true,
        alreadyRead: true,
      },
    );

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
