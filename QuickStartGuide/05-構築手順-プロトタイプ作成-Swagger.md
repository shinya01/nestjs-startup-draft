# 05-構築手順 - プロトタイプ作成 - Swagger

## 📘 Swagger の導入

[Swagger](https://swagger.io/) は API ドキュメントを自動生成・可視化できるツール。  
NestJS では `@nestjs/swagger` を使うことで、簡単に導入が可能。

---

## 📦 必要パッケージのインストール

```bash
npm install --save @nestjs/swagger
```

---

## ⚙️ `.env` への環境変数の追加

環境変数`SWAGGER_XXXX`を追加する

```sh
## Environment Variables .env
PORT=3000
DB_PORT=5432
DB_NAME=myapp
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API server.
SWAGGER_VERSION=1.0.0
```

---

## 🧩 `configuration.ts` への設定の追加

```ts
// src/config/configuration.ts
export default () => ({
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

---

## ✅ `validation.ts` へのバリデーションの追加

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

## 🚀 `main.ts` への Swagger 組み込み

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

  // Swagger の設定
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

> 💡 Swagger UI は `http://localhost:3000/swagger` で確認可能。

---

## 📌 補足ポイント

- `DocumentBuilder` により、API のタイトル・説明・バージョンを `.env` から動的に設定可能  
- `SwaggerModule.setup()` の第1引数 `'swagger'` は URL パスとして任意に変更可能  
- 本番環境では `NODE_ENV` を条件に Swagger を無効化する構成が推奨  

---

## 📝 参照

- <https://docs.nestjs.com/openapi/introduction>
