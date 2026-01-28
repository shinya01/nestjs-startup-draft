# 11-構築手順-プロトタイプ作成-Auth-Auth0

## 🎯 目的

Auth0 を IdP（Identity Provider）として利用し、NestJS アプリケーションでアクセストークン（JWT）の検証、署名確認、およびユーザー情報の解析を行う仕組みを構築します。Auth0 標準の RS256 署名検証に対応したカスタムストラテジーを実装します。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
src/
├── auth/
│   ├── guards/
│   │   ├── auth0-auth.guard.ts
│   │   └── index.ts
│   ├── strategies/
│   │   ├── auth0.strategy.ts
│   │   └── index.ts
│   └── auth.module.ts (修正)
└── .env (追記)
```

---

## 🛠️ 事前準備：Auth0 の設定

### 1. アプリケーションの登録

1. [Auth0 管理画面](https://manage.auth0.com/)で、「Applications」→「Create Application」をクリック。
2. アプリケーションタイプとして「Single Page Application」等を選択。
3. 設定タブから **Domain** と **Client ID** を控える。

### 2. API（Resource Server）の構成

> ⚠️ Auth0 では、アクセストークンに `aud` (audience) クレームを含めるために API の登録が必須です。

1. 「APIs」→「Create API」をクリック。
2. **Identifier** に API の識別子（例: `https://api.example.com`）を入力。これが NestJS 側の `audience` 設定値となります。
3. アプリケーション設定の「Advanced Settings」→「OAuth」にて、デフォルトの `audience` として登録した Identifier を指定（またはトークンリクエスト時に指定）。

---

## 🧪 アクセストークンの取得と検証

### 1. 動作確認用トークンの取得 (curl)

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

### 2. JWT の構造確認

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付け、以下の項目を確認します。

- `iss`: Auth0 のドメイン（末尾に `/` が含まれる）になっているか
- `aud`: API 登録時に指定した Identifier と一致するか
- `sub`: ユーザー識別子またはクライアント ID が含まれているか

---

## 🔐 実装手順

### 1. Auth0Strategy の実装

Auth0 のアクセストークンは標準的な `aud` クレームを含むため、`PassportStrategy` の基本機能で自動検証が可能です。

#### `src/auth/strategies/auth0.strategy.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../exceptions';
import { AuthUser } from '../types';

interface Claim {
  sub: string;
  iss: string;
  aud: string[];
  iat: number;
  exp: number;
  azp: string;
  scope: string;
}

@Injectable()
export class Auth0Strategy extends PassportStrategy(
  JwtStrategyBase,
  'auth0',
) {
  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
    const issuer = configService.get<string>('jwt.issuer') || '';
    const audience = configService.get<string>('jwt.audience') || '';

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
    if (!payload.sub) {
      throw new InvalidTokenException();
    }

    return {
      sub: payload.sub,
      iss: payload.iss,
    };
  }
}
```

#### `src/auth/strategies/index.ts`

```ts
export * from './auth0.strategy';
```

---

### 2. Auth0AuthGuard の実装

開発支援機能（`AUTH_DISABLE`）を組み込んだガードを実装します。

#### `src/auth/guards/auth0-auth.guard.ts`

```ts
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

#### `src/auth/guards/index.ts`

```ts
export * from './auth0-auth.guard';
```

---

### 3. AuthModule の修正

作成したストラテジーとガードをモジュールに登録します。

#### `src/auth/auth.module.ts`

```ts
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

## ✅ 補足ポイント

- **環境変数の反映**: Auth0 特有のドメイン URL や API Identifier を `.env` に正確に反映させてください。
- **Issuer の末尾スラッシュ**: Auth0 の Issuer URL は通常末尾に `/` が含まれます。検証エラーが発生する場合、ここが一致しているか確認してください。
- **Audience の設定**: Identifier を指定せずにトークンを取得すると、JWT 形式ではない Opaque Token が返ることがあります。必ず `audience` を指定してリクエストしてください。

## 📝 参照

- [Auth0 Docs: Validate Access Tokens](https://auth0.com/docs/tokens/access-tokens/validate-access-tokens)
- [NestJS Passport documentation](https://docs.nestjs.com/recipes/passport)
