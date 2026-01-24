# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🎯 目的

NestJS のモジュール構成と DTO バリデーションを導入し、  
**堅牢で拡張性のあるアプリケーションの土台**を構築する。

---

## 🧱 ディレクトリ構成（例）

```
src/
├── common/
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── article.repository.ts
│   │   └── index.ts
│   └── common.module.ts
├── user/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── user-id-param.dto.ts
│   │   └── user.dto.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── article/
│   ├── dto/
│   │   ├── create-article.dto.ts
│   │   └── article.dto.ts
│   ├── article.controller.ts
│   ├── article.service.ts
│   └── article.module.ts
```

---

## 🧾 DTO 定義

### `user.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  email: string;
}
```

---

### `article.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserDto } from '../../user/dto/user.dto';

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
import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsNotEmpty()
  @Length(2, 50)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @Length(6, 100)
  password: string;
}
```

---

### `create-article.dto.ts`

```ts
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

## 🛠️ UserService（DTO変換あり）

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../common/repositories';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional-cls-hooked';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

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
    const user = await this.userRepo.save(data);
    return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
  }
}
```

---

## 🛠️ ArticleService（DTO変換あり）

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ArticleRepository, UserRepository } from '../common/repositories';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleDto } from './dto/article.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getAll(): Promise<ArticleDto[]> {
    const articles = await this.articleRepo.findAllWithAuthor();
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
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

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
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleDto } from './dto/article.dto';
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

## 🧩 UserModule / ArticleModule / CommonModule

### `user.module.ts`

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

### `article.module.ts`

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

## 🚀 AppModule の実装

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';

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
- `plainToInstance()` + `excludeExtraneousValues: true` で安全なレスポンス整形
- `ValidationPipe` によって DTO バリデーションと型変換が自動化
- Repository 層で TypeORM を抽象化し、Service 層はビジネスロジックに集中
- Swagger による API ドキュメントも自動生成され、開発効率アップ！


