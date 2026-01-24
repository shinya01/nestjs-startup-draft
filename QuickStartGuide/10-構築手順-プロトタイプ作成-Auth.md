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
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── auth.module.ts
├── config/
│   ├── configuration.ts
│   └── validation.ts
├── user/
│   ├── dto/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
├── common/
│   ├── entities/
│   ├── repositories/
│   └── common.module.ts
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

## ⚙️ `.env` にJWT関連の設定を追加

```dotenv
# JWT設定（外部IdPに合わせて変更）
JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/
JWT_AUDIENCE=your-client-id
AUTH_DISABLE=false
```

---

## 🧩 `configuration.ts` にJWT設定を追加

```ts
export default () => ({
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
  AUTH_DISABLE: Joi.boolean().default(false),
  JWKS_URI: Joi.string().uri().required(),
  JWT_ISSUER: Joi.string().uri().required(),
  JWT_AUDIENCE: Joi.string().required(),
});
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
  constructor(configService: ConfigService) {
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
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload['cognito:groups'] || [],
    };
  }
}
```

### 💡 JWTストラテジーの仕組み補足

- **jwtFromRequest**  
  → リクエストの `Authorization: Bearer <token>` ヘッダーからJWTを抽出。

- **secretOrKeyProvider**  
  → `jwks-rsa` を使って、外部IdPの公開鍵をJWKS URIから自動取得し、署名検証に使用。

- **audience / issuer / algorithms**  
  → トークンの発行者・対象・署名アルゴリズムを検証し、信頼できるトークンかをチェック。

- **validate()**  
  → トークンのペイロードから必要な情報を抽出し、`req.user` にセットされるオブジェクトを返す。

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

## 🧩 `auth.module.ts` に登録

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
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
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // 他のモジュール
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
```

---

## 🎮 Controller に適用（UserController）

```ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../common/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UserIdParamDto } from './dto/user-id-param.dto';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: '認証に失敗しました' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'JWT情報取得' })
  @ApiResponse({ status: 200 })
  getProfile(@Request() req: { user?: any }): { user?: any } {
    return { user: req?.user };
  }

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, type: User })
  getById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.getById(params.id);
  }

  @Post()
  @ApiOperation({ summary: '新しいユーザーを作成' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: User })
  create(@Body() body: CreateUserDto): Promise<User> {
    return this.userService.create(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ユーザーを削除（管理者のみ）' })
  @ApiParam({ name: 'id', description: 'ユーザーID' })
  @ApiResponse({ status: 200, description: '削除成功' })
  @ApiForbiddenResponse({ description: '権限がありません' })
  remove(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.remove(params.id);
  }
}
```

---

## ✅ まとめ

この構成で…

- 外部IdPのJWTを安全に検証し、ユーザー情報を取得できる！
- 認証スキップやロール制御の拡張も簡単！
- SwaggerでのAPI仕様も明確に！
