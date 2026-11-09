
import { describe, expect, it } from 'vitest';
import { getMembershipAlert } from './membership-alert.js';

describe('H14 - Alertas de membresía', () => {
  it('no solicita confirmación para membresías vigentes', () => {
    const result = getMembershipAlert('VIGENTE');

    expect(result.requiresConfirmation).toBe(false);
    expect(result.code).toBe('OK');
  });

  it('genera alerta para membresías vencidas', () => {
    const result = getMembershipAlert('VENCIDA');

    expect(result.requiresConfirmation).toBe(true);
    expect(result.code).toBe('MEMBRESIA_VENCIDA');
  });

  it('genera alerta cuando no existe membresía', () => {
    const result = getMembershipAlert('SIN_MEMBRESIA');

    expect(result.requiresConfirmation).toBe(true);
    expect(result.code).toBe('SIN_MEMBRESIA');
  });

  it('incluye un mensaje de advertencia', () => {
    const result = getMembershipAlert('VENCIDA');

    expect(result.message).toContain('Confirme');
  });
});
