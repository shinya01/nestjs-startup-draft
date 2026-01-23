import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../common/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserIdParamDto } from './dto/user-id-param.dto';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'JWT情報取得' })
  @ApiResponse({ status: 200 })
  getProfile(@Request() req: { user?: User }): { user?: User } {
    return { user: req?.user };
  }

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
  getById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.getById(params.id);
  }

  @Post()
  @ApiOperation({ summary: '新しいユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: User })
  create(@Body() body: CreateUserDto): Promise<User> {
    return this.userService.create(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ユーザーを削除' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, description: '削除成功' })
  remove(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.remove(params.id);
  }
}
