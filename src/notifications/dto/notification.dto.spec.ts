import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { NotificationQueryDto } from './notification.dto.js';

describe('H34: unread estricto', () => {
  it('preserva true y false sin convertir false en true', async () => {
    for (const [input, expected] of [['true', true], ['false', false]] as const) {
      const dto = plainToInstance(NotificationQueryDto, { unread: input });
      expect(dto.unread).toBe(expected);
      expect(await validate(dto)).toHaveLength(0);
    }
  });
  it('rechaza basura, 1, 0 y cadena vacía', async () => {
    for (const unread of ['basura', '1', '0', '']) {
      const dto = plainToInstance(NotificationQueryDto, { unread });
      expect((await validate(dto)).some((error) => error.property === 'unread')).toBe(true);
    }
  });
  it('permite omitir el filtro', async () => {
    expect(await validate(plainToInstance(NotificationQueryDto, {}))).toHaveLength(0);
  });
});
