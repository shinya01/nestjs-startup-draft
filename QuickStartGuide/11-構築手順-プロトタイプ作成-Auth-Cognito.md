# 11-構築手順-プロトタイプ作成-Auth-Cognito

## 🎯 目的

AWS Cognito を IdP（Identity Provider）として利用し、NestJS アプリケーションでアクセストークン（JWT）の検証、署名確認、およびユーザー情報の解析を行う仕組みを構築します。Cognito 特有の Claim 構造に対応したカスタムストラテジーを実装します。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
src/
├── auth/
│   ├── guards/
│   │   ├── cognito-auth.guard.ts
│   │   └── index.ts
│   ├── strategies/
│   │   ├── cognito.strategy.ts
│   │   └── index.ts
│   └── auth.module.ts (修正)
└── .env (追記)
```

---

## 🛠️ 事前準備：AWS Cognito の設定

### 1. ユーザープールの作成

1. AWS コンソールで Cognito を開き、「ユーザープールを作成」をクリック。
2. サインインオプションで「メールアドレス」を選択。
3. パスワードポリシーや MFA はプロトタイプに合わせて任意に設定。
4. アプリクライアントを作成し、**「クライアントシークレットなし」**を選択。

### 2. アプリクライアントの構成

- **クライアントID** を控える。
- 「ホストされたUI」を使用する場合、リダイレクトURI（例: `http://localhost:3000/callback`）を登録。
- 認証フローで `Authorization code grant` または `Allow user password auth` (プロトタイプ用) を有効化。
- スコープで `openid`, `email`, `profile` を選択。

---

## 🧪 アクセストークンの取得と検証

### 1. 動作確認用トークンの取得 (curl)

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

### 2. JWT の構造確認

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付け、以下の項目を確認します。

- `iss`: ユーザープールの URL になっているか
- `token_use`: `access` になっているか
- `client_id`: アプリクライアント ID と一致するか

---

## 🔐 実装手順

### 1. CognitoStrategy の実装

Cognito はアクセストークンに `aud` を含まず、代わりに `client_id` を使用するため、`validate` メソッド内で手動チェックを行います。

#### `src/auth/strategies/cognito.strategy.ts`

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
    if (!payload.sub || payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }

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

#### `src/auth/strategies/index.ts`

```ts
export * from './cognito.strategy';
```

---

### 2. CognitoAuthGuard の実装

開発支援機能（`AUTH_DISABLE`）を組み込んだガードを実装します。

#### `src/auth/guards/cognito-auth.guard.ts`

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

#### `src/auth/guards/index.ts`

```ts
export * from './cognito-auth.guard';
```

---

### 3. AuthModule の修正

作成したストラテジーとガードをモジュールに登録します。

#### `src/auth/auth.module.ts`

```ts
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

## ✅ 補足ポイント

- **環境変数の反映**: 修正した `.env` の情報を各環境（`development`, `devcontainer` 等）に反映させてください。
- **Audience の検証**: Cognito のアクセストークン検証において、`client_id` のチェックはセキュリティ上重要です。
- **デバッグ**: 認証に失敗する場合は `jwt.io` でトークンの `iss` と `.env` の `JWT_ISSUER` が完全に一致（末尾のスラッシュの有無など）しているか確認してください。

## 📝 参照

- [AWS Documentation: Verifying a JWT from a User Pool](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [NestJS Passport documentation](https://docs.nestjs.com/recipes/passport)
