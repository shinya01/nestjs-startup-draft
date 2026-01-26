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

\```bash
curl -X POST \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d '{
    "AuthFlow": "USER_PASSWORD_AUTH",
    "AuthParameters": {
      "USERNAME": "<USER_EMAIL>",
      "PASSWORD": "<USER_PASSWORD>"
    },
    "ClientId": "<YOUR_CLIENT_ID>"
  }' \
  https://cognito-idp.ap-northeast-1.amazonaws.com/
\```

---

## 🔍 JWTの構造と `jwt.io` による解析

取得した `access_token` を [jwt.io](https://jwt.io/) に貼り付けて確認：

- Header：`alg` は `RS256`、`kid` に注目  
- Payload：`sub`, `email`, `client_id`, `token_use`, `exp` などを確認  
- Signature：Cognitoの公開鍵（JWKS）で署名されていることを確認

---

## 🔐 Cognito用 `JwtStrategy` の実装

\```ts
// src/auth/strategies/cognito.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKeyProvider: jwksSecret,
  issuer,
  algorithms: ['RS256'],
  passReqToCallback: true,
}, 'cognito'); // 👈 Strategy名を明示
\```

---

## 🧪 ルートごとの適用方法

\```ts
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('cognito'))
@Get('cognito-protected')
getCognitoData() {
  return { message: 'This route is protected by Cognito JWT' };
}
\```

---

## ⚙️ `.env` の設定

\```env
JWKS_URI=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/.well-known/jwks.json
JWT_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
JWT_AUDIENCE=<your-client-id>
\```

---

## ✅ 補足

- `JwtStrategy` に名前（`'cognito'`）を付けることで、他のStrategyとの併用が可能  
- デフォルトStrategyを指定する場合は `PassportModule.register({ defaultStrategy: 'cognito' })` を使用  
- 複数のIdPを併用する場合は、ルートごとに `@UseGuards(AuthGuard('strategy-name'))` を明示すること

---

## ✅ まとめ

この構成で…

- ✅ CognitoのアクセストークンをNestJSで安全に検証可能  
- ✅ JWTの構造を理解し、署名の正当性を確認可能  
- ✅ ユーザー情報をトークンから抽出し、アプリ内で活用可能  
- ✅ 他のIdP（Auth0やAzure AD）への応用も容易

---
