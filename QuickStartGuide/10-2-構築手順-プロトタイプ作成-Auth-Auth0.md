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

\```bash
curl --request POST \
  --url https://<your-domain>.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "grant_type": "password",
    "username": "<USER_EMAIL>",
    "password": "<USER_PASSWORD>",
    "audience": "<YOUR_API＿SUDIENCE>",
    "scope": "openid email profile",
    "client_id": "<YOUR_CLIENT_ID>"
  }'
\```

---

## 🔍 JWTの構造と `jwt.io` による解析

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付けて確認：

- Header：`alg` は `RS256`、`kid` に注目  
- Payload：`sub`, `email`, `aud`, `iss`, `exp` などを確認  
- Signature：Auth0の公開鍵（JWKS）で署名されていることを確認

---

## 🔐 Auth0用 `JwtStrategy` の実装

\```ts
// src/auth/strategies/auth0.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKeyProvider: jwksSecret,
  issuer,
  audience,
  algorithms: ['RS256'],
}, 'auth0'); // 👈 Strategy名を明示
\```

---

## 🧪 ルートごとの適用方法

\```ts
@UseGuards(AuthGuard('auth0'))
@Get('auth0-protected')
getAuth0Data() {
  return { message: 'This route is protected by Auth0 JWT' };
}
\```

---

## ⚙️ `.env` の設定

\```env
JWKS_URI=https://<your-domain>.auth0.com/.well-known/jwks.json
JWT_ISSUER=https://<your-domain>.auth0.com/
JWT_AUDIENCE=https://api.example.com
\```

---

## ✅ 補足

- Auth0では、アクセストークンに `aud` を含めるために「API（Resource Server）」の登録が必要  
- Strategy名（`'auth0'`）を付けることで、他のIdPとの併用が可能  
- ルートごとに `@UseGuards(AuthGuard('auth0'))` を指定することで、明示的に適用可能  
- デフォルトStrategyを使う場合は `PassportModule.register({ defaultStrategy: 'auth0' })` を使用

---

## ✅ まとめ

この構成で…

- ✅ Auth0のアクセストークンをNestJSで安全に検証可能  
- ✅ audience（API Identifier）を指定してトークンを取得・検証可能  
- ✅ JWTの構造を理解し、署名の正当性を確認可能  
- ✅ ユーザー情報をトークンから抽出し、アプリ内で活用可能  
- ✅ 他のIdP（CognitoやAzure AD）への応用も容易
