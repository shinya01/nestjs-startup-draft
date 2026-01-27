# 10-2 - 構築手順 - プロトタイプ作成 - Auth - Auth0

> ✅ この章では、NestJSでAuth0のアクセストークン（JWT）を検証するための構成を紹介することを目的とする

Auth0をIdP（Identity Provider）として利用し、アクセストークンの署名検証・ユーザー情報の取得・トークンの解析を行う構成を構築。  
NestJSアプリケーション側では、Auth0が発行するJWTを検証し、ユーザー認証を実現。

---

## 🛠️ 導入手順

1. Auth0テナントの作成とアプリケーションの登録  
2. Auth0 API（Resource Server）の登録とaudience設定  
3. Postmanやcurlを使ったアクセストークンの取得  
4. JWTの構造と `jwt.io` を使ったトークンの確認  
5. NestJS側でAuth0用の `JwtStrategy` を実装  
6. `.env` にAuth0の設定を追加  
7. `configuration.ts` / `validation.ts` にJWT設定を追加  
8. `JwtAuthGuard` を適用し、認証を有効化

---

## 🧩 Auth0アプリケーションの作成

1. [Auth0管理画面](https://manage.auth0.com/) にログイン  
2. 「Applications」→「Applications」→「Create Application」  
3. アプリ名を入力し、アプリケーションタイプは **「Single Page Application (SPA)」** を選択  
4. 作成後、以下を確認：
   - Domain（例：`your-tenant.auth0.com`）  
   - Client ID（例：`abc123XYZ...`）

---

## 🔐 Auth0 API（Resource Server）の登録

> ⚠️ Auth0では、アクセストークンに `aud`（audience） を含めるために、Auth0管理画面で「API」を登録する必要がある。  
> このAPIの「Identifier」が、JWTの `aud` に設定され、NestJS側の検証対象となる。

1. Auth0管理画面 → 「APIs」 → 「Create API」  
2. 以下を入力：
   - **Name**：任意（例：`My NestJS API`）  
   - **Identifier**：`https://api.example.com`（← これが audience になる）  
   - **Signing Algorithm**：RS256（デフォルト）

3. 作成後、SPAアプリケーションの設定に戻り、  
   「Advanced Settings」→「OAuth」→ `audience` にこの Identifier を指定

---

## 🧪 アクセストークンの取得方法

```bash
curl --request POST 
  --url https://<YOUR_DOMAIN>/oauth/token 
  --header 'content-type: application/json' 
  --data '{
    "grant_type": "http://auth0.com/oauth/grant-type/password-realm",
    "username": "<USER_EMAIL>",
    "password": "<USER_PASSWORD>",
    "client_id": "<YOUR_CLIENT_ID>",
    "audience": "<YOUR_API_AUDIENCE>",
    "scope": "openid email profile",
    "realm": "Username-Password-Authentication"
  }'
```

---

## 🔍 JWTの構造と `jwt.io` による解析

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付けて確認
[JSONフォーマッターサイト](https://jsonformatter.org/)を利用すると便利

---

## 🔐 Auth0用 `JwtStrategy` の実装

```ts
// src/auth/strategies/auth0.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../exceptions';
import { AuthUser } from '../types';

// Auth0のアクセストークンのClaimインターフェース
interface Claim {
  sub: string;
  iss: string;
  aud: string[];
  scope: string;
  exp: number;
  iat: number;
  gty: string;
  azp: string;
}

@Injectable()
export class Auth0Strategy extends PassportStrategy(JwtStrategyBase, 'auth0') {
  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
    const issuer = configService.get<string>('jwt.issuer') || '';
    const audience = configService.get<string>('jwt.audience') ?? '';
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
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: Claim): AuthUser {
    // req.user will be set to the return value of this method
    // You can customize the returned object as needed

    const sub = payload.sub;
    // Ensure the token is an access token
    if (!sub) {
      throw new InvalidTokenException();
    }

    return {
      sub: payload.sub,
      iss: payload.iss,
    };
  }
}
```

---

### `auth/strategies/index.ts`

```ts
// src/auth/strategies/index.ts
export * from './auth0.strategy';
```

---

## 🛡️ Auth0用の認証ガードの定義

```ts
// src/auth/guards/auth0-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../types';

@Injectable()
export class Auth0AuthGuard extends AuthGuard('auth0') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: any, user: TUser, info: any): TUser {
    const disableAuth = this.configService.get<boolean>('app.authDisable');
    if (disableAuth) {
      return { sub: 'dummy-user', iss: 'dummy' } as TUser;
    }

    if (err || !user) {
      // info が Error インスタンスかどうか、またはメッセージを持っているか確認
      let errorMessage = 'Authentication failed';
      if (info instanceof Error) {
        errorMessage = info.message;
      } else if (
        typeof info === 'object' &&
        info !== null &&
        'message' in info
      ) {
        errorMessage = String((info as { message: unknown }).message);
      } else if (typeof info === 'string') {
        errorMessage = info;
      }
      throw err instanceof Error
        ? err
        : new UnauthorizedException(errorMessage);
    }
    return user;
  }
}
```

---

### `auth/guards/index.ts`

```ts
// src/auth/guards/index.ts
export * from './auth0-auth.guard';
```

### `auth.module.ts`

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Auth0Strategy } from './strategies';
import { Auth0AuthGuard } from './guards';

@Module({
  imports: [PassportModule.register({})],
  providers: [Auth0Strategy, Auth0AuthGuard],
  exports: [PassportModule, Auth0AuthGuard],
})
export class AuthModule {}
```

---

## 🧪 ルートごとの適用方法

```ts
import { UseGuards } from '@nestjs/common';
import { Auth0AuthGuard } from '../auth/guards';

@UseGuards(Auth0AuthGuard)
@Get('cognito-protected')
getCognitoData() {
  return { message: 'This route is protected by Auth0 JWT' };
}
```

---

## ⚙️ `.env`, `xxxx.env` にJWTの情報を追加

```sh
JWKS_URI=https://<YOUR_DOMAIN>/.well-known/jwks.json
JWT_ISSUER=https://<YOUR_DOMAIN>/
JWT_AUDIENCE=<YOUR_API_AUDIENCE>
```
