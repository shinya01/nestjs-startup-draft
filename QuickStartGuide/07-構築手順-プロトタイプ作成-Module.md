# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🎯 目的

NestJS のモジュール構成と DTO バリデーションを導入し、  
堅牢で拡張性のあるアプリケーションの土台を構築。

---

## 📁 ディレクトリ構成（例）

```
src/
├── user/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── user-id-param.dto.ts
│   │   ├── user.dto.ts
│   │   └── index.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user.module.ts
│   └── index.ts
├── article/
│   ├── dto/
│   │   ├── create-article.dto.ts
│   │   ├── article.dto.ts
│   │   └── index.ts
│   ├── article.controller.ts
│   ├── article.service.ts
│   ├── article.module.ts
│   └── index.ts
```

## 📦 トランザクション管理の導入

### 🎯 導入目的

Service 層でのデータ更新処理において、複数のリポジトリ操作を安全にまとめて実行するために、トランザクション制御を導入。  
NestJS + TypeORM 環境においては、`typeorm-transactional` ライブラリを用いることで、シンプルかつ柔軟なトランザクション管理が可能。

---

### 🧩 ライブラリのインストール

```bash
npm install typeorm-transactional
```

---

### ⚙️ トランザクションコンテキストの初期化

```ts
// src/main.ts
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

async function bootstrap() {
  // トランザクションコンテキストの初期化
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  ...
}
```

---

### ⚙️ DataSource の拡張設定

```ts
// src/app.module.ts
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

@Module({
  ...
  imports: [
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
        logging: config.get('app.env') !== 'production',
      }),
      // DataSource をトランザクション対応に拡張
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Invalid options passed');
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return addTransactionalDataSource(dataSource);
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

### ✅ 効果と利点

- `@Transactional()` を付与するだけで、トランザクションスコープを自動的に開始・終了  
- 複数のリポジトリ操作を 1 トランザクションにまとめることで、整合性を確保  
- 明示的な `queryRunner` の管理が不要となり、Service 層の実装がシンプルに  
- 非同期処理間でもトランザクションスコープを維持できるため、信頼性の高い更新処理が実現可能  

---

## 🧾 DTO 定義

### `user.dto.ts`

```ts
// src/user/dto/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class UserDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  @Type(() => UserInfoDto)
  info: UserInfoDto;
}

export class UserInfoDto {
  @ApiProperty()
  @Expose()
  name: string;
}
```

---

### `article.dto.ts`

```ts
// src/article/dto/article.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dto';

export class ArticleDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty({ type: () => UserDto })
  @Expose()
  @Type(() => UserDto)
  author: UserDto;
}
```

---

### `create-user.dto.ts`

```ts
// src/user/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @Length(2, 50)
  name: string;
}
```

---
### `create-article.dto.ts`

```ts
// src/article/dto/create-article.dto.ts
import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  content: string;

  @ApiProperty()
  authorId: number;
}
```

---

## 🛠️ UserService の実装（User + UserInfo 統合）

> `@Transactional()` を付与することで、ユーザー作成処理全体を 1 トランザクションとして実行し、途中でエラーが発生した場合は自動的にロールバックされる構成。

```ts
// src/user/user.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserRepository, UserInfoRepository } from '../common/repositories';
import { CreateUserDto } from './dto';
import { UserDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional-cls-hooked';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly userInfoRepo: UserInfoRepository,
  ) {
    this.logger.log('UserService created');
  }

  async getAll(): Promise<UserDto[]> {
    const users = await this.userRepo.findAll();
    return plainToInstance(UserDto, users, { excludeExtraneousValues: true });
  }

  async getById(id: number): Promise<UserDto> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }

  @Transactional()
  async create(data: CreateUserDto): Promise<UserDto> {
    const user = await this.userRepo.save({ email: data.email });
    await this.userInfoRepo.save({ name: data.name, user });
    const created = await this.userRepo.findById(user.id);
    return plainToInstance(UserDto, created, { excludeExtraneousValues: true });
  }
}
```

---

## 🛠️ ArticleService の実装

> `@Transactional()` により、記事作成時にユーザーの存在確認と記事保存を一括でトランザクション管理し、整合性を確保。

```ts
// src/article/article.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArticleRepository, UserRepository } from '../common/repositories';
import { CreateArticleDto } from './dto';
import { ArticleDto } from './dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
  ) {
    this.logger.log('ArticleService created');
  }

  async getAll(): Promise<ArticleDto[]> {
    const articles = await this.articleRepo.findAll();
    return plainToInstance(ArticleDto, articles, {
      excludeExtraneousValues: true,
    });
  }

  async create(data: CreateArticleDto): Promise<ArticleDto> {
    const author = await this.userRepo.findById(data.authorId);
    if (!author) throw new NotFoundException('Author not found');
    const article = await this.articleRepo.save({
      title: data.title,
      content: data.content,
      author,
    });
    return plainToInstance(ArticleDto, article, {
      excludeExtraneousValues: true,
    });
  }
}
```

---

## 🎮 UserController の実装

```ts
// src/user/user.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UserDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '全ユーザーを取得' })
  @ApiResponse({ status: 200, type: [UserDto] })
  getAll() {
    return this.userService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, type: UserDto })
  getById(@Param('id') id: number) {
    return this.userService.getById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'ユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: UserDto })
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }
}
```

---

## 🎮 ArticleController の実装

```ts
// src/article/article.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto, ArticleDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Articles')
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: '全記事を取得' })
  @ApiResponse({ status: 200, type: [ArticleDto] })
  getAll() {
    return this.articleService.getAll();
  }

  @Post()
  @ApiOperation({ summary: '記事を作成' })
  @ApiBody({ type: CreateArticleDto })
  @ApiResponse({ status: 201, type: ArticleDto })
  create(@Body() body: CreateArticleDto) {
    return this.articleService.create(body);
  }
}
```

---

## 🧩 モジュール構成の登録

### `user.module.ts`

```ts
// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

---

### `article.module.ts`

```ts
// src/article/article.module.ts
import { Module } from '@nestjs/common';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}
```

---

## 🧩 DTO ディレクトリの index.ts

### `user/dto/index.ts`

```ts
// src/user/dto/index.ts
export * from './create-user.dto';
export * from './user.dto';
export * from './user-id-param.dto';
```

### `article/dto/index.ts`

```ts
// src/article/dto/index.ts
export * from './create-article.dto';
export * from './article.dto';
```

---

## 🧩 モジュールディレクトリの index.ts

### `user/index.ts`

```ts
// src/user/index.ts
export * from './user.module';
export * from './user.service';
export * from './user.controller';
```

### `article/index.ts`

```ts
// src/article/index.ts
export * from './article.module';
export * from './article.service';
export * from './article.controller';
```

---

## 🚀 AppModule の実装

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';
import { UserModule } from './user';
import { ArticleModule } from './article';

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
    ArticleModule,
  ],
})
export class AppModule {}
```

---

## ✅ 補足ポイント

- Entity には `@Exclude()` を使って、パスワードなどの機密情報を除外  
- DTO には `@Expose()` を使って、明示的に出力項目を制御  
- `plainToInstance()` + `excludeExtraneousValues: true` によって安全なレスポンス整形を実現  
- `ValidationPipe` によって DTO バリデーションと型変換を自動化  
- Repository 層で TypeORM を抽象化し、Service 層はビジネスロジックに集中  
- Swagger による API ドキュメントの自動生成により、開発効率が向上  
- 各ディレクトリに `index.ts` を配置することで、インポートの簡略化と保守性を向上  
- Service クラスでは `Logger` を使って生成時にログを出力し、デバッグ性を向上  
- `typeorm-transactional` による `@Transactional()` デコレーターの導入により、Service 層でのトランザクション制御を簡潔に実装  
- `initializeTransactionalContext()` と `addTransactionalDataSource()` によって、非同期処理間でもトランザクションスコープを維持可能  
- 明示的な `queryRunner` の管理が不要となり、トランザクション処理の記述を簡素化  

---
