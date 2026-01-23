# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🧱 ディレクトリ構成（例）

```
src/
├── common/
│   ├── entities/
│   │   ├── user.entity.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   └── index.ts
│   └── common.module.ts
├── user/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── user-id-param.dto.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
```

---

## 📦 必要なパッケージのインストール

```bash
npm install --save class-validator class-transformer
npm install --save typeorm-transactional-cls-hooked
```

---

## 🧾 DTO の作成

### `create-user.dto.ts`

```ts
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

---

### `user-id-param.dto.ts`

```ts
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
  initializeTransactionalContext();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

## 🎮 `UserController` の実装

```ts
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

## 🛠️ `UserService` の実装

```ts
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
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Transactional()
  async create(data: CreateUserDto): Promise<User> {
    return this.userRepo.save(data);
  }

  @Transactional()
  async remove(id: number): Promise<void> {
    await this.userRepo.delete(id);
  }
}
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
- `ValidationPipe` の `whitelist: true` によって、DTO に定義されていないプロパティは自動で除外されるからセキュリティ的にも安心！
- Swagger のエラーレスポンス（404, 400など）も明示しておくと、API 利用者にとって親切！
- 今後、ユースケース層やレスポンス整形（Interceptor）を導入すれば、さらにクリーンな設計