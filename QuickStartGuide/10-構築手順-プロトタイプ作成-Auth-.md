# 08-構築手順 - プロトタイプ作成 - Auth（外部IdP × JWT認証）

## 🔐 認証の概要

この構成では、外部のIDプロバイダ（IdP）から発行されたJWTトークンを使って、NestJSアプリに認証機能を追加。  
トークンの署名検証には、JWKS（JSON Web Key Set）を使って公開鍵を自動取得する方式を採用。

---

## 🧱 ディレクトリ構成（認証関連）

```txt
src/
├── auth/
│   ├── guards/
│   │   ├── xxx-auth.guard.ts
│   │   └── index.ts
│   ├── decorators/
│   │   └── index.ts
│   ├── exceptions/
│   │   ├── unauthorized.exception.ts
│   │   └── index.ts
│   ├── strategies/
│   │   ├── xxx.strategy.ts
│   │   └── index.ts
│   └── auth.module.ts
├── common/
│   ├── decorators/
│   │   ├── api-success-response.decorator.ts
│   │   ├── api-paginated-response.decorator.ts
│   │   ├── api-auth-error-responses.decorator.ts
│   │   └── index.ts
│   ├── swagger/
│   │   ├── success-response.dto.ts
│   │   ├── paginated-response.dto.ts
│   │   ├── error-response.dto.ts
│   │   └── index.ts
│   └── common.module.ts
```

---

## 📦 必要なパッケージのインストール

```bash
npm install passport passport-jwt jwks-rsa @nestjs/passport
npm install --save-dev @types/passport-jwt
```

---

## ⚙️ `.env` ファイルへのJWT設定の追加

```sh
# .env
PORT=3000
DB_PORT=5432
DB_NAME=myapp
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0
```

```sh
## Environment Variables .env.development
DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devspass

AUTH_DISABLE=false
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
```

```sh
## Environment Variables .env.production
DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=superpass

AUTH_DISABLE=false
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
```

```sh
## Environment Variables .env.devcontainer
DB_HOST=db
DB_USER=devuser
DB_PASS=devpass

AUTH_DISABLE=false
JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxx/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxx
JWT_AUDIENCE=xxxxxxxxxxxxxxxxxx
```

---

## 🧩 `configuration.ts` にJWT設定を追加

```ts
// src/config/configuration.ts
export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    authDisable: process.env.AUTH_DISABLE === 'true',
  },
  swagger: {
    title: process.env.SWAGGER_TITLE,
    description: process.env.SWAGGER_DESCRIPTION,
    version: process.env.SWAGGER_VERSION,
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    name: process.env.DB_NAME,
  },
  jwt: {
    jwksUri: process.env.JWKS_URI,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  },
});
```

---

## ✅ `validation.ts` にバリデーションを追加

```ts
// src/config/validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'devcontainer')
    .default('development'),

  PORT: Joi.number().default(3000),

  SWAGGER_TITLE: Joi.string().required(),
  SWAGGER_DESCRIPTION: Joi.string().required(),
  SWAGGER_VERSION: Joi.string().required(),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  AUTH_DISABLE: Joi.boolean().default(false),
  JWKS_URI: Joi.string().uri().required(),
  JWT_ISSUER: Joi.string().uri().required(),
  JWT_AUDIENCE: Joi.string().required(),
});
```

---

## 🆕 認証用の独自例外の実装

```ts
// src/auth/exceptions/unauthorized.exception.ts
import { UnauthorizedException } from '@nestjs/common';

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super('トークンが無効です');
  }
}
```

---

## 🧩 `auth/exceptions/index.ts`

```ts
// src/auth/exceptions/index.ts
export * from './unauthorized.exception';
```

---

## 🆕 `AuthUser` 型インターフェースの定義 `

```ts
// src/auth/types/auth-user.interface.ts
export interface AuthUser {
  sub: string;
  iss: string;
}
```

---

## 🧩 `auth/types/index.ts`

```ts
// src/auth/types/index.ts
export * from './auth-user.interface';
```

---

## 🔑 JWTストラテジーの定義

> 各IDPストラテジー実装を参照。

---

## 🆕 共通エラーデコレーター（401・403）

```ts
// src/common/decorators/api-auth-error-responses.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../swagger/error-response.dto';

export function ApiAuthErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: '認証に失敗しました',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: '権限がありません',
      type: ErrorResponseDto,
    }),
  );
}
```

---

## 🧩 `common/decorators/index.ts` に追加

```ts
// src/common/decorators/index.ts
export * from './api-error-response.decorator';
export * from './api-paginated-response.decorator';
export * from './api-success-response.decorator';
export * from './api-auth-error-responses.decorator';
```

---

## 🧩 `app.module.ts` への組み込み

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
import { AuthModule } from './auth/auth.module';

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
    AuthModule,
    UserModule,
    ArticleModule,
  ],
})
export class AppModule {}
```

---

## 🎮 Controller への適用例（User / Article）

> 以下は`CognitoAuthGuard`(Cognito)を使う実装例です。

```ts
// src/user/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UserDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { CognitoAuthGuard } from 'src/auth/guards';

@ApiTags('Users')
@Controller('users')
@ApiErrorResponses()
@ApiBearerAuth('access-token')
@UseGuards(CognitoAuthGuard)
@ApiAuthErrorResponses()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {
    this.logger.log('UserController created');
  }

  @Get()
  @ApiOperation({ summary: '全ユーザーを取得' })
  @ApiSuccessResponse({ model: UserDto, isArray: true })
  getAll() {
    return this.userService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiSuccessResponse({ model: UserDto })
  getById(@Param('id') id: number) {
    return this.userService.getById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'ユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiSuccessResponse({
    model: UserDto,
    description: 'ユーザー作成成功',
    statusCode: 201,
  })
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }
}
```

```ts
// src/article/article.controller.ts
import { Controller, Get, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto, ArticleDto } from './dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { CognitoAuthGuard } from 'src/auth/guards';

@ApiTags('Articles')
@Controller('articles')
@ApiErrorResponses()
@ApiBearerAuth('access-token')
@UseGuards(CognitoAuthGuard)
@ApiAuthErrorResponses()
export class ArticleController {
  private readonly logger = new Logger(ArticleController.name);

  constructor(private readonly articleService: ArticleService) {
    this.logger.log('ArticleController created');
  }

  @Get()
  @ApiOperation({ summary: '全記事を取得' })
  @ApiSuccessResponse({ model: ArticleDto, isArray: true })
  getAll() {
    return this.articleService.getAll();
  }

  @Post()
  @ApiOperation({ summary: '記事を作成' })
  @ApiBody({ type: CreateArticleDto })
  @ApiSuccessResponse({
    model: ArticleDto,
    description: '記事作成成功',
    statusCode: 201,
  })
  create(@Body() body: CreateArticleDto) {
    return this.articleService.create(body);
  }
}
```

---

## 🚀 `main.ts` でのSwagger定義の追加

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
import { HttpExceptionFilter } from './common/filters';
import { ErrorResponseDto, SuccessResponseDto } from './common/swagger';
import { ResponseTransformInterceptor } from './common/interceptors';

async function bootstrap() {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOに定義されていないプロパティを除外
      transform: true, // 型変換を有効化
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    // Bearer認証の設定
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Auth0 access token here',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [SuccessResponseDto, ErrorResponseDto],
  });

  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

## ✅ 補足ポイント

- `JwtStrategy` によって、**外部IdPのJWTを安全に検証**
- `JwtAuthGuard` によって、**認証の有効・無効を環境変数で制御**
- `@ApiAuthErrorResponses()` によって、**Swagger UI に401/403のレスポンスを明示**
- `@UseGuards(JwtAuthGuard)` によって、**Controller単位で認証を適用**
- `@ApiBearerAuth()` によって、**Swagger上でトークン入力欄を表示**
- `AuthModule` によって、**認証機能をモジュール単位で分離・管理**

---

## 📝 参照

- <https://docs.nestjs.com/recipes/passport>
- <https://www.passportjs.org/packages/passport-jwt>
- <https://mseeeen.msen.jp/passport-jwt-authentication-on-express>
- <https://zenn.dev/uttk/articles/9095a28be1bf5d>
- <https://docs.nestjs.com/guards>
