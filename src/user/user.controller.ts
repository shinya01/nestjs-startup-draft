import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiAuthErrorResponses()
@ApiErrorResponses()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '全ユーザーを取得' })
  @ApiSuccessResponse({ model: UserDto, isArray: true })
  getAll(): Promise<UserDto[]> {
    return this.userService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiSuccessResponse({ model: UserDto })
  getById(@Param('id') id: number): Promise<UserDto> {
    return this.userService.getById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'ユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiSuccessResponse({
    model: UserDto,
    description: 'ユーザー作成成功',
    statusCode: 201,
  })
  create(@Body() body: CreateUserDto): Promise<UserDto> {
    return this.userService.create(body);
  }
}
