import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { NotificationValidationError } from '../../notifications/services/notification.service.js';

/** H35 deja el error interno sin HTTP; la capa de transporte lo traduce a 400. */
@Catch(NotificationValidationError)
export class NotificationValidationFilter implements ExceptionFilter<NotificationValidationError> {
  catch(error: NotificationValidationError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      code: error.code,
      message: error.message,
      field: error.field,
    });
  }
}
