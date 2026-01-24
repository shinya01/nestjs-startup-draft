// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule], // 共通モジュール（リポジトリやエンティティ）をインポート
  controllers: [UserController], // このモジュールで使うコントローラー
  providers: [UserService], // このモジュールで使うサービス
})
export class UserModule {}
