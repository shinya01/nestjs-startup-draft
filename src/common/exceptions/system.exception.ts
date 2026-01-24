// src/common/exceptions/system.exception.ts
import { InternalServerErrorException } from '@nestjs/common';

export class SystemException extends InternalServerErrorException {
  constructor(message = 'Internal server error', cause?: unknown) {
    super({ message }, { cause });
  }
}
