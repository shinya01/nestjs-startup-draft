# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🎯 目的

NestJS のモジュール構成と DTO バリデーションを導入し、  
堅牢で拡張性のあるアプリケーションの土台を構築。

---

## 📁 ディレクトリ構成

```txt
src/
├── user/
│   ├── dto/
│   │   ├── request/
│   │   │   ├── create-user.dto.ts
│   │   │   └── user-id-param.dto.ts
│   │   ├── user.dto.ts
│   │   └── index.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── article/
│   ├── dto/
│   │   ├── request/
│   │   │   └── create-article.dto.ts
│   │   ├── article.dto.ts
│   │   └── index.ts
│   ├── article.controller.ts
│   ├── article.service.ts
│   └── article.module.ts
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
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

async function bootstrap() {
  // トランザクションコンテキストの初期化
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

### ⚙️ DataSource の拡張設定

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // dotenv-flow による読み込みのため NestJS 側では無効化
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
        logging: config.get('app.env') !== 'production', // 本番環境ではログを無効化
        synchronize: false, // 自動同期を無効化
      }),
      // dataSourceFactory を追加して Transactional を有効化
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Invalid options passed');
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return addTransactionalDataSource(dataSource);
      },
      inject: [ConfigService],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('app.env') === 'production' ? 'info' : 'debug',
          transport:
            config.get('app.env') !== 'production'
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

### 🧩 DTO実装に必要なライブラリのインストール

```bash
npm install class-validator class-transformer
```

### 🧩 DTO定義で使うデコレーターの役割

#### `@ApiProperty()`

- `@nestjs/swagger` が提供するデコレーター  
- Swagger UI にプロパティの型や説明を表示するために使用  
- APIドキュメントの自動生成に必要不可欠  
- オプションで `description`, `example`, `required` なども指定可能

#### `@Expose()`

- `class-transformer` が提供するデコレーター  
- `plainToInstance()` や `instanceToPlain()` を使った変換時に、**出力対象に含めるプロパティ**を明示  
- セキュリティやレスポンス制御のために、**明示的に出力項目を制御したい場合に有効**

#### `@Type(() => Class)`

- `class-transformer` のデコレーター  
- ネストされたオブジェクトの型情報を指定し、正しく変換できるようにする  
- 特に `UserInfoDto` のような入れ子構造のDTOで必須

#### `class-validator` による入力バリデーション

`class-validator` は、DTOに対して**入力値の検証ルールを定義するためのデコレーター群**を提供するライブラリ。  
NestJSでは、`ValidationPipe` と組み合わせることで、**自動的にリクエストボディのバリデーションを実行**できる。

##### ✅ よく使うバリデーションデコレーター一覧

| デコレーター | 検証内容 | 使用例 |
| -------------- | ---------- | -------- |
| `@IsString()` | 文字列であること | `@IsString() name: string;` |
| `@IsNumber()` | 数値であること | `@IsNumber() age: number;` |
| `@IsEmail()` | メールアドレス形式 | `@IsEmail() email: string;` |
| `@IsNotEmpty()` | 空でないこと | `@IsNotEmpty() name: string;` |
| `@IsOptional()` | 任意項目として扱う | `@IsOptional() nickname?: string;` |
| `@Min(n)` / `@Max(n)` | 数値の最小・最大値 | `@Min(0) @Max(100) score: number;` |
| `@Length(min, max)` | 文字列の長さ制限 | `@Length(3, 20) username: string;` |
| `@ValidateNested()` | ネストされたオブジェクトの検証 | `@ValidateNested() info: UserInfoDto;` |

> 💡 ネストされたオブジェクトを検証する場合は、`@ValidateNested()` と `@Type(() => Class)` をセットで使う必要がある

## 🧱 Userモジュールの実装

### 🧩 UserモジュールのDTO定義の実装

#### `user.dto.ts`

```ts
// src/user/dto/response/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class UserInfoDto {
  @ApiProperty()
  @Expose()
  name: string;
}

export class UserDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({
    type: () => UserInfoDto,
    nullable: true,
    required: false,
    description: 'ユーザーの追加情報。存在しない場合はnull。',
  })
  @Expose()
  @Type(() => UserInfoDto)
  info?: UserInfoDto | null;
}
```

---

#### `create-user.dto.ts`

```ts
// src/user/dto/request/create-user.dto.ts
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

### `user/dto/request/index.ts`

```ts
// src/user/dto/request/index.ts
export * from './create-user.dto';
```

---

### `user/dto/index.ts`

```ts
// src/user/dto/index.ts
export * from './request';
export * from './user.dto';
```

### 🛠️ UserService の実装（User + UserInfo 統合）

> `@Transactional()` を付与することで、ユーザー作成処理全体を 1 トランザクションとして実行し、途中でエラーが発生した場合は自動的にロールバックされる構成。

```ts
// src/user/user.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserRepository, UserInfoRepository } from '../common/repositories';
import { UserDto, CreateUserDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

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

### 🎮 UserController の実装

```ts
// src/user/user.controller.ts
import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {
    this.logger.log('UserController created');
  }

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

## 🧱 Articleモジュールの実装

### 🧩 ArticleモジュールのDTO定義の実装

#### `article.dto.ts`

```ts
// src/article/dto/response/article.dto.ts
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

#### `create-article.dto.ts`

```ts
// src/article/dto/request/create-article.dto.ts
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

### `article/dto/request/index.ts`

```ts
// src/article/dto/request/index.ts
export * from './create-article.dto';
```

---

#### `article/dto/index.ts`

```ts
// src/article/dto/index.ts
export * from './request';
export * from './article.dto';
```

---

### 🛠️ ArticleService の実装

> `@Transactional()` により、記事作成時にユーザーの存在確認と記事保存を一括でトランザクション管理し、整合性を確保。

```ts
// src/article/article.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArticleRepository, UserRepository } from '../common/repositories';
import { ArticleDto, CreateArticleDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

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

  @Transactional()
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

### 🎮 ArticleController の実装

```ts
// src/article/article.controller.ts
import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto, ArticleDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Articles')
@Controller('articles')
export class ArticleController {
  private readonly logger = new Logger(ArticleController.name);

  constructor(private readonly articleService: ArticleService) {
    this.logger.log('ArticleController created');
  }

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

## 🚀 AppModule の実装

`UserModule`と`ArticleModule`を追加する。

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // dotenv-flow による読み込みのため NestJS 側では無効化
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
        logging: config.get('app.env') !== 'production', // 本番環境ではログを無効化
        synchronize: false, // 自動同期を無効化
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Invalid options passed');
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return addTransactionalDataSource(dataSource);
      },
      inject: [ConfigService],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('app.env') === 'production' ? 'info' : 'debug',
          transport:
            config.get('app.env') !== 'production'
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
      inject: [ConfigService],
    }),
    UserModule,
    ArticleModule,
  ],
})
export class AppModule {}

```

---

## 🚀 `main.ts` への DTOバリデーションのグローバル適用設定

```ts
// src/main.ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // DTO のバリデーションをグローバルに適用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOに定義されていないプロパティを除外
      transform: true, // 型変換を有効化
    }),
  );

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

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
- `@Transactional()` によって、Service 層での整合性のある更新処理を実現
- `initializeTransactionalContext()` と `addTransactionalDataSource()` によって、非同期処理間でもトランザクションスコープを維持可能  
- 明示的な `queryRunner` の管理が不要となり、トランザクション処理の記述を簡素化  

---

## 📝 参照

- <https://github.com/Aliheym/typeorm-transactional>
- <https://docs.nestjs.com/techniques/validation>
- <https://docs.nestjs.com/techniques/serialization>
- <https://docs.nestjs.com/controllers>
- <https://docs.nestjs.com/providers>
- <https://docs.nestjs.com/modules>
- <https://docs.nestjs.com/pipes>
- <https://docs.nestjs.com/fundamentals/dynamic-modules>
- <https://docs.nestjs.com/fundamentals/injection-scopes>  