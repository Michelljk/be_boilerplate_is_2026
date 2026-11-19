export type DomainErrorKind =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID'
  | 'FORBIDDEN';
/** Error de negocio independiente de HTTP y del ORM. */
export class DomainError extends Error {
  constructor(
    public readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
