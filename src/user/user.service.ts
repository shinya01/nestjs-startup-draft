// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { UserRepository } from '../common/repositories';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { plainToInstance } from 'class-transformer';
import { BusinessException } from '../common/exceptions';
import { BusinessErrorCodes } from '../common/constants/business-error-codes';
import { Transactional } from 'typeorm-transactional';

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

  async findByExternalId(externalId: string): Promise<UserDto> {
    const user = await this.userRepo.findByExternalId(externalId);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCodes.NOT_FOUND,
        `ユーザー（外部ID: ${externalId}）が見つかりませんでした`,
      );
    }

    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }

  @Transactional()
  async findOrCreateByExternalId(
    externalId: string,
    name: string,
    email: string,
  ): Promise<UserDto> {
    const user = await this.userRepo.findByExternalId(externalId);
    if (!user) {
      const newUser = await this.userRepo.save({
        externalId: externalId,
        name,
        email,
      });
      return plainToInstance(UserDto, newUser, {
        excludeExtraneousValues: true,
      });
    } else {
      await this.userRepo.save(user);
      return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
    }
  }

  @Transactional()
  async create(data: CreateUserDto): Promise<UserDto> {
    const user = await this.userRepo.save(data);
    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }
}
