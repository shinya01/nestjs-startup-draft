// src/common/swagger/error-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import type { BusinessErrorCode } from '../constants/business-error-codes';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: '2026-01-24T11:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/users' })
  path: string;

  @ApiProperty({ example: 'このメールアドレスは既に登録されています' })
  message: string;

  @ApiProperty({ example: 'USER_ALREADY_EXISTS', required: false })
  code?: BusinessErrorCode;
}
