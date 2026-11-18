import { describe, expect, it } from 'vitest';
import {
  EXPIRY_THRESHOLDS_DAYS,
  classCancelledNotice,
  membershipExpiryNotice,
  reservationNotice,
} from './notification-templates.js';

describe('Plantillas de avisos (H31, H32, H33)', () => {
  it('usa los umbrales de 7 y 1 día que exige H31', () => {
    expect(EXPIRY_THRESHOLDS_DAYS).toEqual([7, 1]);
  });

  it('redacta el aviso de vencimiento con la fecha en dd/mm/aaaa', () => {
    const notice = membershipExpiryNotice(
      'm-1',
      'Básico',
      '2026-11-18',
      7,
    );
    expect(notice.title).toBe('Tu membresía vence pronto');
    expect(notice.message).toBe(
      'Tu plan Básico vence el 18/11/2026. Renuévalo para no perder el acceso.',
    );
    expect(notice.dedupeKey).toBe('VENC-m-1-7');
    expect(notice.module).toBe('MEMBRESIAS');
  });

  it('difiere la clave de deduplicación por umbral', () => {
    expect(membershipExpiryNotice('m-1', 'Básico', '2026-11-18', 1).dedupeKey).toBe(
      'VENC-m-1-1',
    );
  });

  it('convierte la hora UTC a la hora civil del gimnasio', () => {
    const notice = reservationNotice(
      'r-9',
      'Spinning',
      '2026-11-11T18:00:00.000Z',
      false,
    );
    expect(notice.title).toBe('Reserva confirmada');
    expect(notice.message).toBe(
      'Tu reserva para Spinning del 11/11/2026 a las 12:00 fue confirmada.',
    );
    expect(notice.dedupeKey).toBe('RES-CONF-r-9');
  });

  it('avisa la liberación del cupo al cancelar la reserva', () => {
    const notice = reservationNotice(
      'r-9',
      'Yoga',
      '2026-11-12T16:30:00.000Z',
      true,
    );
    expect(notice.title).toBe('Reserva cancelada');
    expect(notice.message).toContain('El cupo fue liberado.');
    expect(notice.message).toContain('12/11/2026 a las 10:30');
  });

  it('omite el motivo cuando la sesión se cancela sin explicación', () => {
    const notice = classCancelledNotice('s-3', 'Funcional', '2026-11-13T15:00:00.000Z');
    expect(notice.title).toBe('Clase cancelada');
    expect(notice.message).toBe(
      'La clase Funcional del 13/11/2026 a las 09:00 fue cancelada.',
    );
    expect(notice.dedupeKey).toBe('CANC-s-3');
  });

  it('rechaza una fecha mal formada en lugar de inventarla', () => {
    expect(() => membershipExpiryNotice('m-1', 'Básico', '2026-13-01', 7)).toThrow();
  });
});
