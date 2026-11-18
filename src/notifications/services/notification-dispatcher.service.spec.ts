import { describe, expect, it, vi } from 'vitest';
import { NotificationDispatcher } from './notification-dispatcher.service.js';

const RECIPIENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RESERVATION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SESSION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function dispatcher(event: Record<string, unknown>) {
  const prisma = {
    domainEvent: {
      findMany: vi.fn().mockResolvedValue([event]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const notifications = {
    send: vi.fn().mockResolvedValue({ created: 1, skipped: 0 }),
  };
  return {
    subject: new NotificationDispatcher(prisma as never, notifications as never),
    prisma,
    notifications,
  };
}

describe('NotificationDispatcher (H32 y H33)', () => {
  it('confirma la reserva usando el destinatario persistido en el evento', async () => {
    const event = {
      id: 'e1',
      type: 'CLASS_RESERVATION_CONFIRMED',
      recipientId: RECIPIENT,
      payload: {
        reservationId: RESERVATION,
        className: 'Spinning',
        startsAt: '2026-11-11T18:00:00.000Z',
      },
    };
    const { subject, notifications, prisma } = dispatcher(event);
    await subject.dispatch();
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        memberIds: [RECIPIENT],
        module: 'RESERVAS',
        title: 'Reserva confirmada',
        referenceId: RESERVATION,
        dedupeKey: `RES-CONF-${RESERVATION}`,
      }),
    );
    expect(prisma.domainEvent.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { processedAt: expect.any(Date) },
    });
  });

  it('difiere la cancelación propia de la confirmación', async () => {
    const event = {
      id: 'e2',
      type: 'CLASS_RESERVATION_CANCELLED',
      recipientId: RECIPIENT,
      payload: {
        reservationId: RESERVATION,
        className: 'Yoga',
        startsAt: '2026-11-12T16:30:00.000Z',
      },
    };
    const { subject, notifications } = dispatcher(event);
    await subject.dispatch();
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reserva cancelada',
        dedupeKey: `RES-CANCEL-${RESERVATION}`,
      }),
    );
  });

  it('anuncia la cancelación de la sesión con su motivo', async () => {
    const event = {
      id: 'e3',
      type: 'CLASS_SESSION_CANCELLED',
      recipientId: RECIPIENT,
      payload: {
        sessionId: SESSION,
        className: 'Funcional',
        startsAt: '2026-11-13T15:00:00.000Z',
        cancelReason: 'entrenador enfermo',
      },
    };
    const { subject, notifications } = dispatcher(event);
    await subject.dispatch();
    const sent = notifications.send.mock.calls[0][0] as {
      message: string;
      dedupeKey: string;
      referenceId: string;
    };
    expect(sent.message).toContain(
      'La clase Funcional del 13/11/2026 a las 09:00 fue cancelada',
    );
    expect(sent.message).toContain('Motivo: entrenador enfermo');
    expect(sent.dedupeKey).toBe(`CANC-${SESSION}`);
    expect(sent.referenceId).toBe(SESSION);
  });

  it('no deja un evento huérfano bloqueando la cola', async () => {
    const event = {
      id: 'e4',
      type: 'CLASS_RESERVATION_CONFIRMED',
      recipientId: null,
      payload: { reservationId: RESERVATION },
    };
    const { subject, notifications, prisma } = dispatcher(event);
    await subject.dispatch();
    expect(notifications.send).not.toHaveBeenCalled();
    expect(prisma.domainEvent.update).toHaveBeenCalledWith({
      where: { id: 'e4' },
      data: { processedAt: expect.any(Date) },
    });
  });

  it('no marca como procesado un evento cuyo envío falló', async () => {
    const event = {
      id: 'e5',
      type: 'CLASS_RESERVATION_CONFIRMED',
      recipientId: RECIPIENT,
      payload: {
        reservationId: RESERVATION,
        className: 'Spinning',
        startsAt: '2026-11-11T18:00:00.000Z',
      },
    };
    const { subject, notifications, prisma } = dispatcher(event);
    notifications.send.mockRejectedValueOnce(new Error('bd caída'));
    await subject.dispatch();
    expect(prisma.domainEvent.update).not.toHaveBeenCalled();
  });

  it('descarta un evento sin fecha legible en lugar de reiniciar la cola', async () => {
    const event = {
      id: 'e6',
      type: 'CLASS_RESERVATION_CONFIRMED',
      recipientId: RECIPIENT,
      payload: {
        reservationId: RESERVATION,
        className: 'Spinning',
        startsAt: 'ayer',
      },
    };
    const { subject, notifications, prisma } = dispatcher(event);
    await subject.dispatch();
    expect(notifications.send).not.toHaveBeenCalled();
    expect(prisma.domainEvent.update).toHaveBeenCalledWith({
      where: { id: 'e6' },
      data: { processedAt: expect.any(Date) },
    });
  });
});
