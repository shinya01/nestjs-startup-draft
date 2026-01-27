# 10 - 構築手順 - プロトタイプ作成 - Auth (外部IdP × JWT認証)

## 🔐 認証の概要

本構成では、外部のIDプロバイダ（IdP）から発行されたJWT（JSON Web Token）を検証し、APIの保護を行います。署名検証には **JWKS (JSON Web Key Set)** 方式を採用し、IdPの公開鍵を動的に取得することで、鍵のローテーションにも自動対応する堅牢な設計とします。

---

## 1. 共通基盤の実装

### 📦 必要なパッケージのインストール

```bash
npm install passport passport-jwt jwks-rsa @nestjs/passport
npm install --save-dev @types/passport-jwt
```

### ⚙️ 環境変数とバリデーション

`jwt` セクションを追加し、接続情報を一括管理します。

```ts
// src/config/validation.ts (抜粋)
export const validationSchema = Joi.object({
  // ...既存の設定
  AUTH_DISABLE: Joi.boolean().default(false),
  JWKS_URI: Joi.string().uri().required(),
  JWT_ISSUER: Joi.string().uri().required(),
  JWT_AUDIENCE: Joi.string().required(),
});
```

### 🆕 共通例外と型の定義

```ts
// src/auth/exceptions/unauthorized.exception.ts
export class InvalidTokenException extends UnauthorizedException {
  constructor() { super('トークンが無効です'); }
}

// src/auth/types/auth-user.interface.ts
export interface AuthUser {
  sub: string;
  iss: string;
}
```

---

## 2. Auth0 連携の実装 (10-2)

Auth0は標準的なOIDC準拠のため、`PassportStrategy` の標準機能（audience/issuer）でシンプルに検証可能です。

### 🔐 Auth0Strategy

```ts
// src/auth/strategies/auth0.strategy.ts
@Injectable()
export class Auth0Strategy extends PassportStrategy(JwtStrategyBase, 'auth0') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: configService.get<string>('jwt.jwksUri'),
      }),
      audience: configService.get<string>('jwt.audience'),
      issuer: configService.get<string>('jwt.issuer'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: any): AuthUser {
    if (!payload.sub) throw new InvalidTokenException();
    return { sub: payload.sub, iss: payload.iss };
  }
}
```

---

## 3. Cognito 連携の実装 (10-1)

AWS Cognitoのアクセストークンは `aud` ではなく `client_id` クレームを持つため、`validate` メソッド内で手動チェックを行います。

### 🔐 CognitoStrategy

```ts
// src/auth/strategies/cognito.strategy.ts
@Injectable()
export class CognitoStrategy extends PassportStrategy(JwtStrategyBase, 'cognito') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        jwksUri: configService.get<string>('jwt.jwksUri'),
      }),
      issuer: configService.get<string>('jwt.issuer'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: any): AuthUser {
    // Cognito特有のチェック: client_id を audience として検証
    const audience = this.configService.get<string>('jwt.audience');
    if (payload.client_id !== audience || payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }
    return { sub: payload.sub, iss: payload.iss };
  }
}
```

---

## 🛡️ 認証ガードとコントローラーへの適用

### 認証ガード (共通ロジック)

`AUTH_DISABLE` 環境変数が `true` の場合、ダミーユーザーを返して認証をパスさせます。

```ts
// src/auth/guards/cognito-auth.guard.ts (Auth0も同様)
@Injectable()
export class CognitoAuthGuard extends AuthGuard('cognito') {
  constructor(private configService: ConfigService) { super(); }

  handleRequest(err: any, user: any, info: any) {
    if (this.configService.get<boolean>('app.authDisable')) {
      return { sub: 'dummy-user', iss: 'dummy' };
    }
    if (err || !user) throw err || new UnauthorizedException(info?.message);
    return user;
  }
}
```

### 🎮 Controller への適用

```ts
@ApiTags('Articles')
@Controller('articles')
@ApiBearerAuth('access-token') // Swaggerに鍵アイコンを表示
@UseGuards(CognitoAuthGuard)    // Cognitoガードを適用
@ApiAuthErrorResponses()        // 401/403レスポンスを定義
export class ArticleController {
  // ...各メソッド
}
```

---

## 🚀 Swagger 定義の追加 (main.ts)

Swagger UIからJWTトークンを送信できるように `addBearerAuth` を設定します。

```ts
// src/main.ts
const swaggerConfig = new DocumentBuilder()
  .setTitle(configService.get('swagger.title'))
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT access token',
    },
    'access-token',
  )
  .build();
```

---

## ✅ 補足ポイント

* **IdPの使い分け**:
  * **Auth0**: `RS256` 署名の標準的な検証フローが可能。
  * **Cognito**: `aud` が欠如しているため `client_id` の個別検証が必要。
* **開発効率**: `AUTH_DISABLE=true` 設定により、IdPの設定が完了していない開発初期段階でもAPIロジックの開発を進められます。
* **ドキュメント**: `@ApiAuthErrorResponses()` カスタムデコレーターにより、全エンドポイントに対して一貫した認証エラー（401/403）の説明がSwaggerに付与されます。

---

## 📝 参照

* [NestJS Passport Recipe](https://docs.nestjs.com/recipes/passport)
* [JWKS RSA Passport Secret](https://github.com/auth0/node-jwks-rsa)
