# 05-構築手順-プロトタイプ作成-Swagger

## 🎯 目的

API の仕様を可視化し、ブラウザ上で動作確認を行えるようにするため [Swagger (OpenAPI)](https://swagger.io/) を導入します。
API のタイトルやバージョンなどのメタ情報を環境変数で管理し、本番環境ではドキュメントを非公開にする制御を実装します。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
.
├── .env (修正)
├── src/
│   ├── config/
│   │   ├── configuration.ts (修正)
│   │   └── validation.ts (修正)
│   └── main.ts (修正)
└── package.json (修正: 依存ライブラリ追加)
```

---

## 🛠️ 構築手順

### 1. 必要パッケージのインストール

NestJS 用の Swagger モジュールをインストールします。

```bash
npm install --save @nestjs/swagger
```

### 2. 環境変数の追加

Swagger の表示に使用する情報を `.env` に追記します。

```sh
## .env 
# (既存の設定は維持)
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0
```

### 3. Config 実装の更新

追加した環境変数をアプリケーションから扱えるよう、Config 関連ファイルを修正します。

#### `src/config/configuration.ts`

第2章で決めた「名前付きエクスポート」の形式を維持して追記します。

```ts
export const configuration = () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
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
});
```

#### `src/config/validation.ts`

起動時に設定漏れがないかチェックするためのバリデーションを追加します。

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
});
```

### 4. `main.ts` への Swagger 組み込み

ConfigService から設定を読み込み、Swagger UI を有効化します。

```ts
// src/main.ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // Swagger の設定構築
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'NestJS API')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // production 環境以外（development, devcontainer 等）の場合のみ Swagger UI を公開
  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

## ✅ 完了確認

- [ ] `npm run start:dev` でアプリを起動し、ターミナルにエラーが出ないこと
- [ ] ブラウザで `http://localhost:3000/swagger` にアクセスし、Swagger UI が表示されること
- [ ] `.env` で設定したタイトルや説明文が画面上に反映されていること

## 📌 補足ポイント

- **環境による公開制限**: セキュリティの観点から、本番環境（`production`）では `SwaggerModule.setup` を呼び出さない構成にしています。
- **エンドポイントの変更**: `SwaggerModule.setup('swagger', ...)` の第1引数を書き換えることで、ドキュメントの URL パス（例：`/docs` や `/api-spec`）を自由に変更可能です。

## 📝 参照

- [NestJS OpenAPI (Swagger)](https://docs.nestjs.com/openapi/introduction)
