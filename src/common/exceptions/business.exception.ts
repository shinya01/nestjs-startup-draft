// src/common/exceptions/business.exception.ts
import { HttpStatus, HttpException } from '@nestjs/common';
import { BusinessErrorCode } from '../constants/business-error-codes';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: BusinessErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    cause?: unknown,
  ) {
    super({ message, code }, status, { cause });
  }
}
