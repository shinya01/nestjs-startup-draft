// src/common/decorators/api-auth-error-responses.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../swagger/error-response.dto';

export function ApiAuthErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: '認証に失敗しました',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: '権限がありません',
      type: ErrorResponseDto,
    }),
  );
}
