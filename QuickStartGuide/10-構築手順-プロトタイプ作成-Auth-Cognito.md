# 10-1 - 構築手順 - プロトタイプ作成 - Auth - Cognito

> ✅ この章では、NestJSでCognitoのアクセストークン（JWT）を検証するための構成を紹介することを目的とする

AWS CognitoをIdP（Identity Provider）として利用し、アクセストークンの署名検証・ユーザー情報の取得・トークンの解析を行う構成を構築。  
NestJSアプリケーション側では、Cognitoが発行するJWTを検証し、ユーザー認証を実現。

---

## 🛠️ 導入手順

1. AWS Cognitoユーザープールの作成  
2. アプリクライアントの作成と設定（アクセストークン取得用）  
3. Postmanやcurlを使ったアクセストークンの取得  
4. JWTの構造と `jwt.io` を使ったトークンの確認  
5. NestJS側でCognito用の `JwtStrategy` を実装  
6. `.env` にCognitoの設定を追加  
7. `configuration.ts` / `validation.ts` にJWT設定を追加  
8. `JwtAuthGuard` を適用し、認証を有効化

---

## 🧩 AWS Cognitoユーザープールの作成

1. AWSマネジメントコンソールにログイン  
2. Cognito → 「ユーザープール」 → 「ユーザープールを作成」  
3. 以下の設定を選択：
   - サインインオプション：メールアドレス
   - パスワードポリシー：任意
   - MFA：任意
   - アプリクライアント：作成（クライアントシークレットなし）

---

## 🔑 アプリクライアントの設定

- クライアントIDを控える（例：`xxxxxxxxxxxxxxxxxxxxxxxxxx`）  
- 「ホストされたUI」設定でリダイレクトURIを登録（例：`http://localhost:3000/callback`）  
- 認証フロー：`Authorization code grant` を有効化  
- スコープ：`openid` `email` `profile` を選択

---

## 🧪 アクセストークンの取得方法

```bash
curl -X POST 
  -H "Content-Type: application/x-amz-json-1.1" 
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" 
  -d '{
    "AuthFlow": "USER_PASSWORD_AUTH",
    "AuthParameters": {
      "USERNAME": "<USER_EMAIL>",
      "PASSWORD": "<USER_PASSWORD>"
    },
    "ClientId": "<YOUR_CLIENT_ID>"
  }' 
  https://cognito-idp.ap-northeast-1.amazonaws.com/
```

---

## 🔍 JWTの構造と `jwt.io` による解析

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付けて確認
[JSONフォーマッターサイト](https://jsonformatter.org/)を利用すると便利

---

## 🔐 Cognito用 `JwtStrategy` の実装

```ts
// src/auth/strategies/cognito.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../exceptions';
import { AuthUser } from '../types';

// CognitoのアクセストークンのClaimインターフェース
interface Claim {
  sub: string;
  iss: string;
  client_id: string;
  origin_jti: string;
  event_id: string;
  token_use: string;
  scope: string;
  auth_time: number;
  exp: number;
  iat: number;
  jti: string;
  username: string;
}

@Injectable()
export class CognitoStrategy extends PassportStrategy(
  JwtStrategyBase,
  'cognito',
) {
  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
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
      // audience, // IDPの仕様に合わせる。Cognitoの場合、claimにaudが含まれていないため、このタイミングでaudienceチェック不可。
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
    if (!sub || payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }
    // Cognito特有のクライアントID（audience）チェック
    const audience = this.configService.get<string>('jwt.audience') ?? '';
    if (payload.client_id !== audience) {
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
export * from './cognito.strategy';
```

---

## 🛡️ Cognito用の認証ガードの定義

```ts
// src/auth/guards/cognito-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../types';

@Injectable()
export class CognitoAuthGuard extends AuthGuard('cognito') {
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
export * from './cognito-auth.guard';
```

### `auth.module.ts`

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CognitoStrategy } from './strategies';
import { CognitoAuthGuard } from './guards';

@Module({
  imports: [PassportModule.register({})],
  providers: [CognitoStrategy, CognitoAuthGuard],
  exports: [PassportModule, CognitoAuthGuard],
})
export class AuthModule {}
```

---

## 🧪 ルートごとの適用方法

```ts
import { UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/guards';

@UseGuards(CognitoAuthGuard)
@Get('cognito-protected')
getCognitoData() {
  return { message: 'This route is protected by Cognito JWT' };
}
```

---

## ⚙️ `.env`, `xxxx.env` にJWTの情報を追加

```sh
JWKS_URI=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
JWT_AUDIENCE=<YOUR_CLIENT_ID>
```
