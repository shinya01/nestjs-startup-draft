# 02-構築手順 - プロトタイプ作成 - Config

## 📦 必要なパッケージのインストール

```bash
npm install --save @nestjs/config
npm install --save joi
npm install --save-dev @types/joi
```

---

## 🧹 不要ファイルの削除

NestJS のサンプルファイルを削除：

- `app.controller.ts`
- `app.controller.spec.ts`
- `app.service.ts`

---

## ⚙️ ConfigModule の設定

### 基本設定

- `isGlobal: true`  
  → どのモジュールでも `ConfigService` を使えるようにする。

- `load`  
  → 環境変数を構造化して扱いやすくする。  
  例：`ConfigService.get('database.host')` のようにアクセス可能。

- `validationSchema`  
  → `.env` の値を起動時に検証し、ミスや漏れを防ぐ。

---

## 🌱 dotenv-flow の導入

`.env` ファイルを `.gitignore` から除外し、`dotenv-flow` を使って環境変数を管理する。

```bash
npm install dotenv-flow
npm install --save-dev @types/dotenv-flow
```

> 💡 補足：`dotenv-flow` は `.env` ファイルを自動的に読み込むため、NestJS 側の `ignoreEnvFile: true` を忘れずに設定！

---

## 🗂️ `.env` を Git 管理に含める

`.env` ファイルが `.gitignore` に含まれている場合、Git 管理対象にするには以下の手順を実行：

1. `.gitignore` を開く  
2. 以下のような記述を探す：

```
.env
```

3. 削除またはコメントアウトする：

```diff
- .env
+ # .env
```

> ⚠️ **注意**：`.env.production` や `.env.local` など、機密性の高いファイルは引き続き Git 管理から除外するのが一般的です。  
> チームで共有する場合は、`.env.example` を作成して、必要なキーだけを記載したテンプレートを用意するのがおすすめです。

---

## 📚 読み込み順と優先順位

例：`NODE_ENV=development` の場合、読み込み順は以下の通り：

1. `.env`  
2. `.env.development`  
3. `.env.local`  
4. `.env.development.local`

※ `dotenv-flow` は **後から読み込まれたファイルが優先される** ため、最終的な優先順位は：

```
.env.development.local > .env.local > .env.development > .env
```

---

### 補足

- `.local` が付いたファイルは、**個人のローカル環境用の上書き設定**として使われる。
- `NODE_ENV` に応じて、対応する `.env.<env>` と `.env.<env>.local` が読み込まれる。
- コマンドラインや OS 側で指定された環境変数は、`.env` 系の値よりも優先され、**絶対に上書きされない**。

```bash
NODE_ENV=production DB_HOST=override.example.com node main.js
```

---

## 🧪 実装

### `main.ts`

```ts
// 方法①（推奨）: 自動で読み込む
import 'dotenv-flow/config';

// 方法②: 明示的に読み込む
// import * as dotenvFlow from 'dotenv-flow';
// dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

---

### `app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // ← dotenv-flow で読み込むので NestJS 側では読み込まない
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
```

---

### `src/config/validation.ts`

```ts
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

### `src/config/configuration.ts`

```ts
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

## 🧾 .env ファイル

### `.env`

```
PORT=3000
NODE_ENV=development
DB_PORT=5432
DB_NAME=myapp
```

---

### `.env.development`

```
DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devpass
```

---

### `.env.production`

```
DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=supersecret
```

---

### `.env.devcontainer`

```
DB_HOST=db
DB_USER=devuser
DB_PASS=devpass
```

---

## 🧩 `package.json` の scripts に `NODE_ENV=devcontainer` を追加

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
}
```
