# 08-構築手順 - プロトタイプ作成 - Auth（外部IdP × JWT認証）

## 🔐 認証の概要

この構成では、外部のIDプロバイダ（IdP）から発行されたJWTトークンを使って、NestJSアプリに認証機能を追加するよ。  
トークンの署名検証には、JWKS（JSON Web Key Set）を使って公開鍵を自動取得する方式を採用！

---

## 🧱 ディレクトリ構成（認証関連）

```
src/
├── auth/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts           // 任意（RBAC用）
│   ├── decorators/
│   │   └── roles.decorator.ts       // 任意（RBAC用）
│   ├── exceptions/
│   │   └── unauthorized.exception.ts // 任意（独自例外）
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── auth.module.ts
├── common/
│   ├── decorators/
│   │   └── api-auth-error-responses.decorator.ts
│   ├── filters/
│   ├── swagger/
│   │   └── error-response.dto.ts
│   └── common.module.ts
├── config/
│   ├── configuration.ts
│   └── validation.ts
├── user/
│   ├── dto/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── app.module.ts
└── main.ts
```

---

## 📦 必要なパッケージのインストール

```bash
npm install passport passport-jwt jwks-rsa @nestjs/passport
npm install --save-dev @types/passport-jwt
```

---

## ⚙️ `.env`,`.env.xxxxx` にJWT関連の設定を追加

```dotenv
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
AUTH_DISABLE=false
```

```dotenv
# .env
PORT=3000

SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0

DB_PORT=5432
DB_NAME=myapp
```

```dotenv
# .env.development
NODE_ENV=development

DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devpass

AUTH_DISABLE=false
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
```

```dotenv
# .env.production
NODE_ENV=production

DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=supersecret

AUTH_DISABLE=false
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
```

```dotenv
# .env.devcontainer
NODE_ENV=devcontainer

DB_HOST=db
DB_USER=devuser
DB_PASS=devpass

AUTH_DISABLE=true
JWKS_URI=https://dev-7pubxl28.jp.auth0.com/.well-known/jwks.json
JWT_ISSUER=https://dev-7pubxl28.jp.auth0.com/
JWT_AUDIENCE=https://mynestjs.example.com
```

---

## 🧩 `configuration.ts` にJWT設定を追加

```ts
// src/config/configuration.ts
export default () => ({
  swagger: {
    title: process.env.SWAGGER_TITLE,
    description: process.env.SWAGGER_DESCRIPTION,
    version: process.env.SWAGGER_VERSION,
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    authDisable: process.env.AUTH_DISABLE === 'true',
  },
  jwt: {
    jwksUri: process.env.JWKS_URI,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    name: process.env.DB_NAME,
  },
});
```

---

## ✅ `validation.ts` にバリデーションを追加

```ts
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

## 🆕 認証用の独自例外（任意）

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

## 🔑 JWTストラテジーの定義（`jwt.strategy.ts`）

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../../common/exceptions';

interface Claim {
  sub: string;
  email: string;
  token_use: string;
  auth_time: number;
  iss: string;
  exp: number;
  username: string;
  client_id: string;
  'cognito:groups'?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(JwtStrategyBase) {
  constructor(private readonly configService: ConfigService) {
    const disableAuth = configService.get<boolean>('app.authDisable');
    if (disableAuth) {
      // 認証無効モード：ダミー設定で初期化
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: true,
        secretOrKey: 'dummy-secret', // 実際には使われない
      });
      return;
    }
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
    const audience = configService.get<string>('jwt.audience') || '';
    const issuer = configService.get<string>('jwt.issuer') || '';
    const jwksSecret: SecretOrKeyProvider = jwksRsa.passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksSecret,
      audience,
      issuer,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Claim) {
    // Ensure the token is an access token
    if (payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }
    // Basic validation of required claims
    if (!payload.sub || !payload.email) {
      throw new InvalidTokenException();
    }
    // req.user will be set to the return value of this method
    // You can customize the returned object as needed
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload['cognito:groups'] || [],
    };
  }
}
```

---

## 🛡️ 認証ガードの定義（`jwt-auth.guard.ts`）

```ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const disableAuth = this.configService.get<boolean>('app.authDisable');
    if (disableAuth) {
      return true;
    }
    return super.canActivate(context);
  }
}
```

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

## 🧩 `auth.module.ts` に登録

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [PassportModule, JwtAuthGuard],
})
export class AuthModule {}
```

---

## 🧩 `app.module.ts` に組み込み

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
import { AuthModule } from './auth/auth.module';

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
    AuthModule,
  ],
})
export class AppModule {}
```

---

## 🎮 Controller に適用（UserController, ArticleController）

```ts
import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiAuthErrorResponses()
@ApiErrorResponses()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '全ユーザーを取得' })
  @ApiSuccessResponse({ model: UserDto, isArray: true })
  getAll(): Promise<UserDto[]> {
    return this.userService.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiSuccessResponse({ model: UserDto })
  getById(@Param('id') id: number): Promise<UserDto> {
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
  create(@Body() body: CreateUserDto): Promise<UserDto> {
    return this.userService.create(body);
  }
}
```

```ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleDto } from './dto/article.dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Articles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiAuthErrorResponses()
@ApiErrorResponses()
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

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

## 🚀 `main.ts` でSwagger定義追加

```ts
// src/main.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { ErrorResponseDto } from './common/swagger/error-response.dto';
import { SuccessResponseDto } from './common/swagger';

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
  app.useGlobalFilters(new HttpExceptionFilter()); // HTTP例外フィルター
  app.useGlobalInterceptors(new ResponseTransformInterceptor()); // レスポンス変換グローバルインターセプター

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'My API')
    .setDescription(
      configService.get<string>('swagger.description') || 'API documentation',
    )
    .setVersion(configService.get<string>('swagger.version') || '1.0')
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
    extraModels: [SuccessResponseDto, ErrorResponseDto], // 追加のモデルを登録
  });
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---



## ✅ まとめ

この構成で…

- ✅ 外部IdPのJWTを安全に検証し、ユーザー情報を取得できる！
- ✅ 認証スキップやロール制御の拡張も簡単！
- ✅ SwaggerでのAPI仕様も明確に！
- ✅ 共通エラーデコレーターでドキュメントの保守性も向上！

---

これでマークダウン形式の全文が完成だよ！  
`.md` ファイルに貼り付ければ、**そのままドキュメントとして使える**はず！  
他にも共通レスポンスやページネーションのデコレーターを整えたいときは、いつでも声かけてね🦊📘
