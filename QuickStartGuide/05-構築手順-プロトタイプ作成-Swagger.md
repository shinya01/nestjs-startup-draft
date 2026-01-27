# 05-構築手順 - プロトタイプ作成 - Swagger

## 📘 Swagger の導入

[Swagger (OpenAPI)](https://swagger.io/) は、API の仕様を視覚的に確認し、ブラウザから直接リクエストを試行できるツールです。NestJS では、コードからドキュメントを自動生成する強力な機能が提供されています。

---

## 📦 必要パッケージのインストール

```bash
npm install --save @nestjs/swagger
```

---

## ⚙️ 環境変数の設定 (Config)

Swagger の表示内容を環境に応じて管理できるよう、`.env` および設定クラスを更新します。

### 1. `.env` への追加

```bash
## Swagger Settings
SWAGGER_TITLE="Sample Project API"
SWAGGER_DESCRIPTION="The API description for my NestJS project"
SWAGGER_VERSION="1.0.0"
```

### 2. `validation.ts` へのバリデーション追加

```ts
// src/config/validation.ts
export const validationSchema = Joi.object({
  // ...既存の設定
  SWAGGER_TITLE: Joi.string().required(),
  SWAGGER_DESCRIPTION: Joi.string().required(),
  SWAGGER_VERSION: Joi.string().required(),
});
```

### 3. `configuration.ts` への構造化設定

```ts
// src/config/configuration.ts
export default () => ({
  // ...既存の設定
  swagger: {
    title: process.env.SWAGGER_TITLE,
    description: process.env.SWAGGER_DESCRIPTION,
    version: process.env.SWAGGER_VERSION,
  },
});
```

---

## 🚀 Swagger の自動生成設定 (CLI Plugin)

この設定を追加することで、DTO クラスのプロパティにデコレータを記述しなくても、Swagger 上で自動的に型が認識されるようになります。

`nest-cli.json` を以下のように修正します：

```json
{
  "$schema": "[https://json.schemastore.org/nest-cli](https://json.schemastore.org/nest-cli)",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": ["@nestjs/swagger"]
  }
}
```

---

## 🛠️ main.ts への組み込み

アプリケーションの起動時に Swagger UI をセットアップします。

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

  // Swagger 設定の構築
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title', 'API'))
    .setDescription(configService.get<string>('swagger.description', ''))
    .setVersion(configService.get<string>('swagger.version', '1.0'))
    .addBearerAuth() // 将来的なJWT認証用（必要に応じて）
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // 本番環境以外（devcontainer等）でのみ Swagger UI を公開
  if (configService.get('app.env') !== 'production') {
    SwaggerModule.setup('swagger', app, document);
  }

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}
void bootstrap();
```

---

## ✅ 動作確認

1. アプリケーションを起動： `npm run start:dev`
2. ブラウザでアクセス： `http://localhost:3000/swagger`
3. 定義したエンティティやコントローラー（今後作成するもの）がリストアップされていれば成功です。

---

## 📌 補足ポイント

- **セキュリティ**: 本番環境で Swagger を公開すると API の内部構造が漏洩するリスクがあるため、`NODE_ENV` による条件分岐は必須です。
- **CLI Plugin**: `nest-cli.json` の設定により、コードを汚さずにドキュメントを充実させることが可能になります。
- **複数ドキュメント**: 大規模なプロジェクトでは、`SwaggerModule.createDocument` を複数回呼び出すことで、ドメインごとにドキュメントを分割することも可能です。

---

## 📝 参照

- [NestJS OpenAPI (Swagger) Documentation](https://docs.nestjs.com/openapi/introduction)
- [Swagger CLI Plugin](https://docs.nestjs.com/openapi/cli-plugin)
