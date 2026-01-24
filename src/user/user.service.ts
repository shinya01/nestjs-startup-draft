// src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../common/repositories';
import { User } from '../common/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { Transactional } from 'typeorm-transactional-cls-hooked';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getAll(): Promise<User[]> {
    return this.userRepo.findAll();
  }

  async getById(id: number): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('User not found'); // 404エラーとして返される
    return user;
  }

  @Transactional() // DB変更を伴う処理には必ず付ける
  async create(data: CreateUserDto): Promise<User> {
    return this.userRepo.save(data);
  }

  @Transactional()
  async remove(id: number): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.delete(id);
  }
}
