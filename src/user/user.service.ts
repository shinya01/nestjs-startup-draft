import { Injectable } from '@nestjs/common';
import { UserRepository } from '../common/repositories';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional-cls-hooked';
import { BusinessException } from '../common/exceptions';
import { BusinessErrorCodes } from '../common/constants/business-error-codes';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getAll(): Promise<UserDto[]> {
    const users = await this.userRepo.findAll();
    return plainToInstance(UserDto, users, { excludeExtraneousValues: true });
  }

  async getById(id: number): Promise<UserDto> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCodes.NOT_FOUND,
        `ユーザー（ID: ${id}）が見つかりませんでした`,
      );
    }

    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }

  @Transactional()
  async create(data: CreateUserDto): Promise<UserDto> {
    const user = await this.userRepo.save(data);
    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }
}
