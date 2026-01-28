# 10-構築手順-プロトタイプ作成-Auth（共通基盤）

## 🎯 目的

外部の ID プロバイダ（Amazon Cognito や Auth0 等）から発行された JWT トークンを使って、NestJS アプリに認証機能を追加します。公開鍵を動的に取得する JWKS 方式を採用し、安全かつ柔軟で、開発時には認証をスキップできるプロトタイプ開発に適した認証基盤を構築します。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
src/
├── auth/ (新規作成)
│   ├── exceptions/
│   │   ├── unauthorized.exception.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── auth-user.interface.ts
│   │   └── index.ts
│   └── auth.module.ts
├── common/
│   └── decorators/ (修正)
│       ├── api-auth-error-responses.decorator.ts
│       └── index.ts
├── config/ (修正)
│   ├── configuration.ts
│   └── validation.ts
├── user/
│   └── user.controller.ts (修正)
├── article/
│   └── article.controller.ts (修正)
└── main.ts (修正)
```

---

## 🛠️ 構築手順

### 1. 必要パッケージのインストール

```bash
npm install passport passport-jwt jwks-rsa @nestjs/passport
npm install --save-dev @types/passport-jwt
```

### 2. 環境変数の設定 (.env)

開発・本番・コンテナ環境ごとに IdP の設定を定義します。

```sh
# .env (基本設定)
PORT=3000
DB_PORT=5432
DB_NAME=myapp
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0

# .env.devcontainer (例: AWS Cognito)
AUTH_DISABLE=false
JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxx/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxx
JWT_AUDIENCE=xxxxxxxxxxxxxxxxxx
```

### 3. Config の拡張

#### `src/config/configuration.ts`

```ts
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

#### `src/config/validation.ts`

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

### 4. 認証の仕組み：Strategy と Guard

NestJSにおける認証は、以下の2つの要素を組み合わせて実現します。

1. **Strategy（ストラテジー）**: 届いたJWTが「正しいものか（署名検証）」を確認し、トークンの内容からユーザー情報を抽出するロジック。
2. **Guard（ガード）**: コントローラーへの「門番」。ストラテジーの結果を受け取り、認証成功なら通過させ、失敗なら `401 Unauthorized` を返す。

> 💡 **IdPごとの個別実装（別紙参照）**
> 利用するサービスに合わせて、以下の実装ガイドを参照してください。

- [10-1 構築手順 - Auth - Cognito 実装編]
- [10-2 構築手順 - Auth - Auth0 実装編]

### 5. 認証用基盤の実装

#### `src/auth/exceptions/unauthorized.exception.ts`

```ts
import { UnauthorizedException } from '@nestjs/common';

export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super('トークンが無効です');
  }
}
```

#### `src/auth/exceptions/index.ts`

```ts
export * from './unauthorized.exception';
```

#### `src/auth/types/auth-user.interface.ts`

```ts
export interface AuthUser {
  sub: string;
  iss: string;
}
```

#### `src/auth/types/index.ts`

```ts
export * from './auth-user.interface';
```

> **💡 なぜ `AuthUser` 型を定義するのか？**

1. **型安全性の確保**: トークンをデコードした後の `request.user` にどのようなプロパティ（`sub` や `iss` など）が含まれているかを明示し、開発時のミスを防ぐため。
2. **サービス間連携**: 異なる IdP からの Payload 構造を、アプリ内で扱う標準的なフォーマットに共通化するため。
3. **開発効率の向上**: IDE の自動補完が効くようになり、ユーザー情報の参照が容易になるため。

### 6. AuthModule の実装

認証機能を一つのモジュールとしてカプセル化します。ここにストラテジーやガードを登録することで、他のモジュール（User/Articleなど）で認証機能が利用可能になります。

#### `src/auth/auth.module.ts`

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, PassportModule.register({})],
  providers: [
    // ※ ここに CognitoStrategy や Auth0Strategy を後ほど追加します
    // ※ ここに CognitoAuthGuard や Auth0AuthGuard を後ほど追加します
  ],
  exports: [PassportModule],
})
export class AuthModule {}
```

### 7. Swagger 認証用デコレーターの実装

#### `src/common/decorators/api-auth-error-responses.decorator.ts`

```ts
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

#### `src/common/decorators/index.ts` (追記)

```ts
// ... 既存のエクスポート
export * from './api-auth-error-responses.decorator';
```

### 8. AppModule への統合

#### `src/app.module.ts`

```ts
// ...既存のインポート
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ...既存のインポート
    AuthModule,
  ],
})
export class AppModule {}
```

### 9. コントローラへの適用

#### `src/user/user.controller.ts`

```ts
@ApiTags('Users')
@Controller('users')
@ApiErrorResponses()
@ApiBearerAuth('access-token')      // Swagger上で鍵マークを表示
@UseGuards(CognitoAuthGuard)        // ガードを適用 (詳細は別紙参照)
@ApiAuthErrorResponses()            // 401/403のレスポンス定義
export class UserController { ... }
```

#### `src/main.ts` (Swagger 認証定義の追加)

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle(configService.get<string>('swagger.title') || '')
  .setDescription(configService.get<string>('swagger.description') || '')
  .setVersion(configService.get<string>('swagger.version') || '')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'アクセストークンを入力してください',
    },
    'access-token',
  )
  .build();
```

---

## ✅ 補足ポイント

- **`AUTH_DISABLE` の活用**: 開発中にトークン発行を省略したい場合、`.env` で `true` に設定することでダミーユーザーとして全 API を利用可能です。
- **デコレーターの共通化**: `@ApiAuthErrorResponses()` を作成したことで、各コントローラーに重複して 401/403 の定義を書く必要がなくなり、保守性が向上します。

## 📝 参照

- [NestJS Passport](https://docs.nestjs.com/recipes/passport)
- [node-jwks-rsa](https://github.com/auth0/node-jwks-rsa)
