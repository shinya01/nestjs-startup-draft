# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🧱 ディレクトリ構成（例）

```
src/
├── common/
│   ├── entities/               # エンティティ（DBモデル）を定義
│   │   ├── user.entity.ts
│   │   └── index.ts
│   ├── repositories/           # リポジトリ層（DB操作の抽象化）
│   │   ├── user.repository.ts
│   │   └── index.ts
│   └── common.module.ts        # 共通モジュール
├── user/
│   ├── dto/                    # データ転送オブジェクト（バリデーション用）
│   │   ├── create-user.dto.ts
│   │   └── user-id-param.dto.ts
│   ├── user.controller.ts      # ルーティングとリクエスト処理
│   ├── user.service.ts         # ビジネスロジック
│   └── user.module.ts          # ユーザーモジュール定義
```

---

## 📦 必要なパッケージのインストール

```bash
npm install --save class-validator class-transformer
npm install --save typeorm-transactional-cls-hooked
```

- `class-validator`: DTOにバリデーションルールを定義するためのライブラリ
- `class-transformer`: リクエストデータの型変換を行うライブラリ
- `typeorm-transactional-cls-hooked`: TypeORMでトランザクション制御を簡単に扱うための拡張ライブラリ

---

## 🧾 DTO の作成

### `create-user.dto.ts`

```ts
// src/user/dto/create-user.dto.ts
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
```

- `@IsNotEmpty()`：空でないことを検証
- `@Length(2, 50)`：文字数の範囲を指定
- `@IsEmail()`：メールアドレス形式かを検証

---

### `user-id-param.dto.ts`

```ts
// src/user/dto/user-id-param.dto.ts
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserIdParamDto {
  @ApiProperty({ example: 123 })
  @Type(() => Number)
  @IsInt()
  id: number;
}
```

- `@Type(() => Number)`：文字列を数値に変換
- `@IsInt()`：整数であることを検証

> 💡 `transform: true` を有効にすることで、パスパラメータの型変換が自動で行われるよ！

---

## 🚀 `main.ts` の設定

```ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked';

async function bootstrap() {
  initializeTransactionalContext(); // トランザクションのコンテキスト初期化

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOに定義されていないプロパティを除外
      transform: true, // 型変換を有効化
    }),
  );

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'My API')
    .setDescription(
      configService.get<string>('swagger.description') || 'API documentation',
    )
    .setVersion(configService.get<string>('swagger.version') || '1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

## 🛠️ `UserService` の実装

```ts
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
```

---

## 🎮 `UserController` の実装

```ts
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

@ApiTags('Users')
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
```

---

## 🧩 `UserModule` の実装

```ts
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
```

---

## 🧩 `AppModule` に `UserModule` を追加

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.user'),
        password: config.get('database.pass'),
        database: config.get('database.name'),
        entities: [__dirname + '/common/entities/*.entity{.ts,.js}'],
        synchronize: config.get('database.synchronize'),
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
      },
    }),
    UserModule,
  ],
})
export class AppModule {}
```

---

## ✅ 補足アドバイス

- `@Transactional()` を使うことで、複数の DB 操作を安全にまとめて実行できるよ！
  - 特に、**Service層のDBの読み取り以外（作成・更新・削除など）を行うメソッドには必ず付ける**ようにすると、データの整合性が保たれて安心。
  - 非同期処理の中で例外を握りつぶさないように注意しよう。例外が発生しないとロールバックされないよ！
- `ValidationPipe` の `whitelist: true` によって、DTO に定義されていないプロパティは自動で除外されるからセキュリティ的にも安心！
- `transform: true` を有効にすると、リクエストパラメータの型変換が自動で行われるよ（例：文字列 → 数値）。
- Swagger のエラーレスポンス（404, 400など）も明示しておくと、API 利用者にとって親切！
- `UserRepository` の各メソッド（`findAll`, `findById`, `save`, `delete`）の実装も別途記載しておくと、全体の流れがより明確になるよ。
- 今後、ユースケース層（UseCaseクラス）やレスポンス整形（Interceptor）、例外フィルター（ExceptionFilter）を導入すれば、さらにクリーンで拡張性の高い設計になるよ！

