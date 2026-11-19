import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { MembershipAlertRequiredError } from '../domain/membership-alert.error.js';

@Catch(MembershipAlertRequiredError)
export class MembershipAlertFilter implements ExceptionFilter<MembershipAlertRequiredError> {
  catch(error: MembershipAlertRequiredError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(409).json({
      code: error.code,
      message: error.message,
    });
  }
}
