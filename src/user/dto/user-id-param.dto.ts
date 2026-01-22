// user/dto/user-id-param.dto.ts
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserIdParamDto {
  @ApiProperty({ example: 123 })
  @Type(() => Number) // ← 文字列を数値に変換
  @IsInt()
  id: number;
}
