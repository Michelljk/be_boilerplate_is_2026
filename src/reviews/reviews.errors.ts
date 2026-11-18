/**
 * Textos únicos del dominio de reseñas (H29 y H30).
 *
 * Viven fuera del servicio porque el duplicado también se detecta en el
 * repositorio: la unicidad la garantiza la base de datos
 * (`reviews_member_session_key`) y, dentro de una transacción serializable,
 * un INSERT fallido obliga a abortar la transacción con `DomainError`.
 */
export const REVIEW_MESSAGES = {
  memberOnly: 'Solo el miembro autenticado puede calificar sus sesiones.',
  adminOnly: 'Solo RECEPCION_ADMIN puede consultar los promedios.',
  sessionNotOwned: 'La sesión no existe o no pertenece al miembro autenticado.',
  sessionNotCompleted: 'La sesión no está COMPLETADA.',
  attendanceRequired: 'La sesión no registra asistencia ASISTIO del miembro.',
  duplicateReview: 'El miembro ya calificó esta sesión.',
  commentTooLong: 'El comentario no puede superar 500 caracteres.',
  ratingOutOfRange: 'La calificación debe ser un entero entre 1 y 5.',
} as const;
