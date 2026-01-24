// src/common/swagger/success-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-01-24T12:34:56.789Z' })
  timestamp: string;

  @ApiProperty({ example: '/users' })
  path: string;

  @ApiProperty({ description: 'レスポンスデータ' })
  data: any;
}
