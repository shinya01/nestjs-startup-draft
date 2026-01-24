// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { UserRepository } from '../common/repositories';
import { User } from '../common/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { Transactional } from 'typeorm-transactional-cls-hooked';
import { BusinessException } from '../common/exceptions';
import { BusinessErrorCodes } from '../common/constants/business-error-codes';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getAll(): Promise<User[]> {
    throw new BusinessException(
      BusinessErrorCodes.USER_NOT_FOUND,
      `ユーザー（IDが見つかりませんでした`,
    );
    return this.userRepo.findAll();
  }

  async getById(id: number): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCodes.USER_NOT_FOUND,
        `ユーザー（ID: ${id}）が見つかりませんでした`,
      );
    }
    return user;
  }

  @Transactional()
  async create(data: CreateUserDto): Promise<User> {
    const exists = await this.userRepo.findByEmail(data.email);
    if (exists) {
      throw new BusinessException(
        BusinessErrorCodes.USER_ALREADY_EXISTS,
        'このメールアドレスは既に登録されています',
      );
    }
    return this.userRepo.save(data);
  }

  @Transactional()
  async remove(id: number): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCodes.USER_NOT_FOUND,
        `ユーザー（ID: ${id}）が見つかりませんでした`,
      );
    }
    await this.userRepo.delete(id);
  }
}
