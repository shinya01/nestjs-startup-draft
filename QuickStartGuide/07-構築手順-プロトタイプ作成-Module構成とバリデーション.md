# 07-構築手順-プロトタイプ作成-Module構成とバリデーション

## 🎯 目的

NestJS のモジュール構成を整理し、DTO バリデーションとトランザクション管理を導入します。これにより、データの整合性を保ちつつ、堅牢で拡張性のある API サーバーを構築します。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。DTO は `dto/` 直下に配置し、リクエスト専用のものは `dto/request/` にまとめます。

```text
src/
├── user/ (新規作成)
│   ├── dto/
│   │   ├── request/
│   │   │   ├── create-user.dto.ts
│   │   │   └── index.ts
│   │   ├── user.dto.ts
│   │   └── index.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── article/ (新規作成)
│   ├── dto/
│   │   ├── request/
│   │   │   ├── create-article.dto.ts
│   │   │   └── index.ts
│   │   ├── article.dto.ts
│   │   └── index.ts
│   ├── article.controller.ts
│   ├── article.service.ts
│   └── article.module.ts
├── app.module.ts (修正)
└── main.ts (修正)
```

---

## 🛠️ 構築手順

### 1. 必要パッケージのインストール

```bash
# トランザクション管理
npm install typeorm-transactional

# バリデーション & 変換
npm install class-validator class-transformer
```

### 2. トランザクションとバリデーションのグローバル設定

#### `src/main.ts`

```ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext, StorageDriver } from 'typeorm-transactional';

async function bootstrap() {
  // トランザクションコンテキストの初期化（最優先で実行）
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // DTO のバリデーションをグローバルに適用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOに定義されていないプロパティを自動除外
      transform: true, // リクエストパラメータをDTOの型に自動変換
    }),
  );

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'NestJS API')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '1.0.0')
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

### 3. AppModule の更新

トランザクションを有効化するため、`dataSourceFactory` で明示的に `DataSource` を初期化し、`typeorm-transactional` に登録します。

#### `src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { configuration, validationSchema } from './config';
import { ENTITIES } from './common/entities';
import { CommonModule } from './common/common.module';

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
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.pass'),
        database: config.get<string>('database.name'),
        entities: ENTITIES,
        logging: config.get('app.env') !== 'production',
        synchronize: false,
      }),
      // トランザクションを有効化するための DataSource 生成フロー
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
          transport: config.get('app.env') !== 'production' ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          } : undefined,
        },
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    // ※ UserModule, ArticleModule は実装後にここへ追加します
  ],
})
export class AppModule {}
```

---

### 4. User モジュールの実装

#### `src/user/dto/user.dto.ts`

```ts
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

  @ApiProperty({ type: () => UserInfoDto, nullable: true })
  @Expose()
  @Type(() => UserInfoDto)
  info?: UserInfoDto | null;
}
```

#### `src/user/dto/request/create-user.dto.ts`

```ts
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

#### `src/user/dto/request/index.ts`

```ts
export * from './create-user.dto';
```

#### `src/user/dto/index.ts`

```ts
export * from './request';
export * from './user.dto';
```

#### `src/user/user.service.ts`

```ts
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
    this.logger.log('UserService initialized');
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

#### `src/user/user.controller.ts`

```ts
import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UserDto } from './dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {
    this.logger.log('UserController initialized');
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
  getById(@Param('id') id: string) {
    return this.userService.getById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'ユーザーを作成' })
  @ApiResponse({ status: 201, type: UserDto })
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }
}
```

#### `src/user/user.module.ts`

```ts
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

### 5. Article モジュールの実装

#### `src/article/dto/article.dto.ts`

```ts
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

#### `src/article/dto/request/create-article.dto.ts`

```ts
import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  content: string;

  @ApiProperty()
  @IsNumber()
  authorId: number;
}
```

#### `src/article/dto/request/index.ts`

```ts
export * from './create-article.dto';
```

#### `src/article/dto/index.ts`

```ts
export * from './request';
export * from './article.dto';
```

#### `src/article/article.service.ts`

```ts
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
    this.logger.log('ArticleService initialized');
  }

  async getAll(): Promise<ArticleDto[]> {
    const articles = await this.articleRepo.findAll();
    return plainToInstance(ArticleDto, articles, { excludeExtraneousValues: true });
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
    return plainToInstance(ArticleDto, article, { excludeExtraneousValues: true });
  }
}
```

#### `src/article/article.controller.ts`

```ts
import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto, ArticleDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Articles')
@Controller('articles')
export class ArticleController {
  private readonly logger = new Logger(ArticleController.name);

  constructor(private readonly articleService: ArticleService) {
    this.logger.log('ArticleController initialized');
  }

  @Get()
  @ApiOperation({ summary: '全記事を取得' })
  @ApiResponse({ status: 200, type: [ArticleDto] })
  getAll() {
    return this.articleService.getAll();
  }

  @Post()
  @ApiOperation({ summary: '記事を作成' })
  @ApiResponse({ status: 201, type: ArticleDto })
  create(@Body() body: CreateArticleDto) {
    return this.articleService.create(body);
  }
}
```

#### `src/article/article.module.ts`

```ts
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

### 6. 各モジュールの有効化

実装した `UserModule` と `ArticleModule` を `AppModule` に追加し、アプリケーションで使用可能にします。

#### `src/app.module.ts` (最終修正)

```ts
// ...既存のインポート
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';

@Module({
  imports: [
    // ...既存のインポート
    UserModule,
    ArticleModule,
  ],
})
export class AppModule {}
```

---

## ✅ 補足ポイント

- **汎用的な DTO 設計**: `UserDto` や `ArticleDto` はレスポンスだけでなく、サービス間のデータ転送にも利用可能な形式として定義しています。
- **`plainToInstance` の活用**: `@Expose()` と組み合わせることで、エンティティの内部構造を隠蔽し、必要なプロパティのみを安全に抽出します。
- **`@Transactional()`**: 複数のリポジトリ操作を一括管理し、一方に失敗すれば全てロールバックされるため整合性が保たれます。

---

## 🎬 動作確認（Swagger UI）

実装完了後、実際に API を叩いて動作を確認します。

### 1. アプリケーションの起動

```bash
npm run start:dev
```

### 2. Swagger UI へのアクセス

ブラウザで `http://localhost:3000/swagger` を開きます。

### 3. データの登録と取得

1. **ユーザー作成 (`POST /users`)**:
   - 「Try it out」をクリックし、JSON ボディを入力して「Execute」を実行。
   - `201 Created` と共に、DB に保存されたデータが返ることを確認します。
2. **全ユーザー取得 (`GET /users`)**:
   - 実行後、先ほど登録したユーザーが配列で返ることを確認します。

### 4. バリデーションと例外の確認

- **バリデーションエラー**: `POST /users` で `email` を不正な形式（例: `test-at-example.com`）にして実行すると、`400 Bad Request` が返ることを確認します。
- **404 エラー**: `GET /users/{id}` で存在しない ID を指定すると、`404 Not Found` が返ることを確認します。

---

## 💡 さらに理解を深めるポイント

### 1. 例外処理（Exception Filter）の挙動

この章では `NotFoundException` を使用しました。NestJS には「Built-in HTTP exceptions」が用意されており、これらを `throw` すると、フレームワークが自動的に適切な HTTP ステータスコード（404など）と JSON レスポンスをクライアントに返してくれます。

### 2. DTO による自動型変換（transform: true）

`main.ts` で `ValidationPipe` に `transform: true` を設定しました。これにより、ネットワーク経由で「文字列」として届くクエリパラメータやパスパラメータを、DTO で定義した型（例：`number`）に NestJS が自動でキャストしてくれます。

### 3. トランザクションが守るもの

`UserService.create` では「User の作成」と「UserInfo の作成」という2つの処理を行っています。

もしトランザクションがない状態で UserInfo の作成に失敗すると、DB には「詳細情報（UserInfo）のない User」だけが残ってしまい、データの不整合が起きます。`@Transactional()` を付与することで、一連の処理が「全て成功するか、全て失敗するか」のいずれかになることを保証し、データの整合性を守っています。

---

## 📝 参照

- [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional)
- [NestJS Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS Built-in HTTP Exceptions](https://docs.nestjs.com/exception-filters#built-in-http-exceptions)
