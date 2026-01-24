// src/user/user.controller.ts
import { Controller, Get, Post, Param, Body, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../common/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-response.decorator';

@ApiTags('Users')
@ApiErrorResponses()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '全ユーザーを取得' })
  @ApiResponse({ status: 200, type: [User] })
  getAll(): Promise<User[]> {
    return this.userService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, type: User })
  @ApiResponse({ status: 404, description: 'ユーザーが見つかりませんでした' })
  getById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.getById(params.id);
  }

  @Post()
  @ApiOperation({ summary: '新しいユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: User })
  @ApiResponse({ status: 400, description: 'バリデーションエラー' })
  create(@Body() body: CreateUserDto): Promise<User> {
    return this.userService.create(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ユーザーを削除' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, description: '削除成功' })
  @ApiResponse({ status: 404, description: 'ユーザーが見つかりませんでした' })
  remove(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.remove(params.id);
  }
}
