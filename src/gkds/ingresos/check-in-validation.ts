
export type MembershipStatus =
  | 'VIGENTE'
  | 'VENCIDA'
  | 'SIN_MEMBRESIA';

export interface CheckInInput {
  memberId: string;
  membershipStatus: MembershipStatus;
  confirmExpired?: boolean;
  alreadyCheckedInToday: boolean;
}

export interface CheckInValidationResult {
  allowed: boolean;
  code:
    | 'OK'
    | 'INVALID_MEMBER'
    | 'ALREADY_CHECKED_IN'
    | 'CONFIRMATION_REQUIRED';
  message: string;
  expiredConfirmed: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCheckIn(
  input: CheckInInput,
): CheckInValidationResult {
  if (
    typeof input.memberId !== 'string' ||
    !UUID_REGEX.test(input.memberId)
  ) {
    return {
      allowed: false,
      code: 'INVALID_MEMBER',
      message: 'Identificador de miembro inválido.',
      expiredConfirmed: false,
    };
  }

  if (input.alreadyCheckedInToday) {
    return {
      allowed: false,
      code: 'ALREADY_CHECKED_IN',
      message: 'El miembro ya registró su ingreso hoy.',
      expiredConfirmed: false,
    };
  }

  if (
    !['VIGENTE', 'VENCIDA', 'SIN_MEMBRESIA'].includes(
      input.membershipStatus,
    )
  ) {
    return {
      allowed: false,
      code: 'CONFIRMATION_REQUIRED',
      message: 'Estado de membresía no reconocido.',
      expiredConfirmed: false,
    };
  }

  if (
    input.membershipStatus !== 'VIGENTE' &&
    input.confirmExpired !== true
  ) {
    return {
      allowed: false,
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Membresía vencida o inexistente: confirme para registrar el ingreso.',
      expiredConfirmed: false,
    };
  }

  return {
    allowed: true,
    code: 'OK',
    message: 'Ingreso autorizado.',
    expiredConfirmed:
      input.membershipStatus !== 'VIGENTE' &&
      input.confirmExpired === true,
  };
}
