# 02-構築手順 - プロトタイプ作成 - Config

## 📦 必要なパッケージのインストール

設定機能に必要なパッケージの導入：

```bash
npm install --save @nestjs/config
npm install --save joi
npm install --save-dev @types/joi
```

---

## 🧹 不要ファイルの削除

NestJS の初期サンプルファイルの削除：

- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/app.service.ts`

---

## ⚙️ ConfigModule の設定

### 基本設定

- `isGlobal: true`  
  → 全モジュールで `ConfigService` の利用を可能にする設定。

- `load`  
  → 環境変数の構造化によるアクセス性の向上。  
  例：`ConfigService.get('database.host')` のような参照。

- `validationSchema`  
  → `.env` の値を起動時に検証し、設定ミスの防止。

---

## 🌱 dotenv-flow の導入

`.env` ファイルの自動読み込みと環境ごとの切り替え管理のため、`dotenv-flow` を導入：

```bash
npm install dotenv-flow
npm install --save-dev @types/dotenv-flow
```

> 💡 補足：`dotenv-flow` による読み込みを行うため、NestJS 側では `ignoreEnvFile: true` の設定が必要。

---

## 🗂️ `.env` ファイルの Git 管理

`.env` ファイルが `.gitignore` に含まれている場合の対応手順：

1. `.gitignore` を開く  
2. 以下の記述を確認：

    ```txt
    .env
    ```

3. 削除またはコメントアウト：

    ```diff
    - .env
    + # .env
    ```

> ⚠️ **注意**：`.env.production` や `.env.local` など、機密性の高いファイルは引き続き Git 管理から除外するのが一般的。  
> チームで共有する場合は、`.env.example` を作成し、必要なキーのみを記載したテンプレートの用意がおすすめ。

---

## 📚 読み込み順と優先順位

例：`NODE_ENV=development` の場合の読み込み順：

1. `.env`  
2. `.env.development`  
3. `.env.local`  
4. `.env.development.local`

> `dotenv-flow` は **後から読み込まれたファイルが優先される** ため、最終的な優先順位は以下の通り：

```txt
.env.development.local > .env.local > .env.development > .env
```

---

### 補足

- `.local` が付いたファイルは、**個人のローカル環境用の上書き設定**としての利用。
- `NODE_ENV` に応じた `.env.<env>` および `.env.<env>.local` の自動読み込み。
- コマンドラインや OS 側で指定された環境変数は `.env` よりも優先され、**上書き不可**。

```bash
NODE_ENV=production DB_HOST=override.example.com node main.js
```

---

## 🧪 実装

### `validation.ts`

```ts
// src/config/validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'devcontainer')
    .default('development'),

  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
});
```

---

### `configuration.ts`

```ts
// src/config/configuration.ts
export default () => ({
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

### `app.module.ts`

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // dotenv-flow による読み込みのため NestJS 側では無効化
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
```

---

### `main.ts`

```ts
// src/main.ts
// 方法①（推奨）：自動読み込み
import 'dotenv-flow/config';

// 方法②：明示的な読み込み
// import * as dotenvFlow from 'dotenv-flow';
// dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

---

## 🧾 `.env` ファイルの例

### `.env`

```sh
## Environment Variables .env
PORT=3000
DB_PORT=5432
DB_NAME=myapp
```

---

### `.env.development`

```sh
## Environment Variables .env.development
DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devspass
```

---

### `.env.production`

```sh
## Environment Variables .env.production
DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=superpass
```

---

### `.env.devcontainer`

```sh
## Environment Variables .env.devcontainer
DB_HOST=db
DB_USER=devuser
DB_PASS=devpass
```

---

## 🧩 `package.json` の scripts 設定

`NODE_ENV=devcontainer` を指定したスクリプトの追加：

```json
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "NODE_ENV=devcontainer nest start",
    "start:dev": "NODE_ENV=devcontainer nest start --watch",
    "start:debug": "NODE_ENV=devcontainer nest start --debug --watch",
    "start:prod": "NODE_ENV=devcontainer node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
```

## 📝 参照

- <https://docs.nestjs.com/techniques/configuration>
- <https://github.com/kerimdzhanov/dotenv-flow>
