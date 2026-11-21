import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../errors/domain.error.js';
const statuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID: 400,
  FORBIDDEN: 403,
} as const;
const labels = {
  NOT_FOUND: 'Not Found',
  CONFLICT: 'Conflict',
  INVALID: 'Bad Request',
  FORBIDDEN: 'Forbidden',
} as const;
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statuses[error.kind])
      .json({
        statusCode: statuses[error.kind],
        error: labels[error.kind],
        message: error.message,
      });
  }
}
