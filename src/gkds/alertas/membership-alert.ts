
export type MembershipAccessStatus =
  | 'VIGENTE'
  | 'VENCIDA'
  | 'SIN_MEMBRESIA';

export interface MembershipAlert {
  requiresConfirmation: boolean;
  code: 'OK' | 'MEMBRESIA_VENCIDA' | 'SIN_MEMBRESIA';
  message: string;
}

export function getMembershipAlert(
  status: MembershipAccessStatus,
): MembershipAlert {
  switch (status) {
    case 'VIGENTE':
      return {
        requiresConfirmation: false,
        code: 'OK',
        message: 'La membresía está vigente.',
      };

    case 'VENCIDA':
      return {
        requiresConfirmation: true,
        code: 'MEMBRESIA_VENCIDA',
        message:
          'La membresía está vencida. Confirme antes de registrar el ingreso.',
      };

    case 'SIN_MEMBRESIA':
      return {
        requiresConfirmation: true,
        code: 'SIN_MEMBRESIA',
        message:
          'El miembro no tiene una membresía. Confirme antes de registrar el ingreso.',
      };
  }
}
