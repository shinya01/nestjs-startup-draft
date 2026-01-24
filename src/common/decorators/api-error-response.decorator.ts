// src/common/decorators/api-error-response.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../swagger/error-response.dto';

export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'バリデーションエラーまたは業務エラー',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: 'システムエラー',
      type: ErrorResponseDto,
    }),
  );
}
