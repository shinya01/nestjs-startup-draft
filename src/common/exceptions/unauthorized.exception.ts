// src/auth/exceptions/unauthorized.exception.ts
import { UnauthorizedException } from '@nestjs/common';

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super('トークンが無効です');
  }
}
