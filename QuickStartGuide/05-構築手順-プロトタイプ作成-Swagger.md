# 05-構築手順 - プロトタイプ作成 - Swagger

## 📘 Swagger とは？

[Swagger](https://swagger.io/) は API ドキュメントを自動生成・可視化できるツール。  
NestJS では `@nestjs/swagger` を使って簡単に導入できるよ！

---

## 📦 必要なパッケージのインストール

```bash
npm install --save @nestjs/swagger
```

---

## ⚙️ `.env` に Swagger 用の環境変数を追加

```dotenv
PORT=3000

# 追加
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0

DB_PORT=5432
DB_NAME=myapp
```

---

## 🧩 `configuration.ts` に Swagger 設定を追加

```ts
// src/config/configuration.ts
export default () => ({
  swagger: {
    title: process.env.SWAGGER_TITLE,
    description: process.env.SWAGGER_DESCRIPTION,
    version: process.env.SWAGGER_VERSION,
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
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

---

## ✅ `validation.ts` に Swagger 用のバリデーションを追加

```ts
// src/config/validation.ts
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

---

## 🚀 `main.ts` に Swagger を組み込む

```ts
// main.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
```

> 💡 Swagger UI は `http://localhost:3000/swagger` で確認できるよ！

---

## 📌 補足

- `DocumentBuilder` を使って、API のタイトル・説明・バージョンを `.env` から動的に設定できる！
- `SwaggerModule.setup()` の第1引数 `'swagger'` は、URL パス。変更可能！
- 本番環境では Swagger を無効化したい場合、`NODE_ENV` を見て条件分岐するのもおすすめ！

```ts
if (configService.get('NODE_ENV') !== 'production') {
  SwaggerModule.setup('swagger', app, document);
}
```

---

これで Swagger による API ドキュメントの自動生成ができるようになったよ！📄✨  
開発中の確認や、チーム・フロントエンドとの連携にも超便利！  
次は DTO に `@ApiProperty()` を付けて、よりリッチなドキュメントにしていこう〜！💧
