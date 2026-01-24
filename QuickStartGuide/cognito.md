# 🔐 Cognito × NestJS バックエンド認証確認手順（Hosted UIなし）

## 🎯 目的

AWS CognitoのHosted UIを使わずに、**アクセストークンを直接取得し、NestJSのJWT認証APIを確認**するための手順です。  
バックエンドのみで動作確認したい開発・検証用途に最適です。

---

# 🏗️ AWS Cognito ユーザープール構築手順（マネジメントコンソール）

## ✅ 1. ユーザープールの作成

1. AWSマネジメントコンソールにログイン  
2. サービス一覧から「Cognito」を選択  
3. 「ユーザープール」→「ユーザープールを作成」  
4. 「手動でユーザープールを作成」を選択

---

## 🧩 2. ユーザープールの設定

### 基本設定

| 項目 | 設定例 |
|------|--------|
| アプリケーションタイプ | `SPA` |
| プール名 | `MyAppUserPool` |
| サインイン方法 | メールアドレス（またはユーザー名） |
| パスワードポリシー | 任意（開発中は緩めでもOK） |
| MFA | 無効（開発中）または必要に応じて有効化 |
| ユーザー属性 | `email` を必須にする |

---

## ⚙️ 3. アプリクライアントの作成

1. ユーザープール作成後、「アプリケーションクライアント」タブを開く  
2. 「アプリクライアントを追加」→ 以下のように設定：

| 項目 | 設定内容 |
|------|----------|
| クライアント名 | `my-app-client` |
| 認可フロー | `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`を有効化 |
| IDトークンの有効期限 | 任意（例：60分） |
| アクセストークンの有効期限 | 任意（例：60分） |


---

## 📋 5. 必要な情報を控える

| 項目 | 取得場所 | 用途 |
|------|----------|------|
| ユーザープールID | ユーザープールの概要 | JWTの `issuer` に使用 |
| リージョン | 例：`ap-northeast-1` | `jwksUri` に使用 |
| クライアントID | アプリクライアント設定 | JWTの `audience` に使用 |
| JWKS URI | 自動生成 | JWT署名検証に使用 |

### `.env` 設定例（NestJS）

```env
JWT_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXX
JWT_AUDIENCE=your-client-id
JWT_JWKS_URI=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_XXXXXXX/.well-known/jwks.json
```

---

# 🎟️ アクセストークン取得〜API動作確認の流れ

## ✅ 1. ユーザー登録（初回のみ）

1. Cognito管理画面から「ユーザーを作成」  
2. メールアドレスとパスワードを設定  
3. メール確認が必要な場合は、確認コードを入力して有効化

---

## 🧪 2. アクセストークンを取得（curl）

```bash
curl -X POST 
  https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/token 
  -H "Content-Type: application/x-www-form-urlencoded" 
  -d "grant_type=password" 
  -d "client_id=<your-client-id>" 
  -d "username=<your-email>" 
  -d "password=<your-password>" 
  -d "scope=openid email"
```

### 例：

```bash
curl -X POST \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d '{
    "AuthFlow": "USER_PASSWORD_AUTH",
    "AuthParameters": {
      "USERNAME": "kudo.shinya01@gmail.com",
      "PASSWORD": "8Ay1hs41!!"
    },
    "ClientId": "7qpt4flj0ie4omj3vh0oblfkqa"
  }' \
  https://cognito-idp.ap-northeast-1.amazonaws.com/
```
