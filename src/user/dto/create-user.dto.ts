import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Taro Tanaka' })
  @IsNotEmpty()
  @Length(2, 50)
  name: string;

  @ApiProperty({ example: 'taro@example.com' })
  @IsEmail()
  email: string;
}
