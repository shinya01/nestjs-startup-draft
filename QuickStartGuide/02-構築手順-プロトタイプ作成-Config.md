# 02-構築手順-プロトタイプ作成-Config

## 🎯 目的

環境変数（`.env`）を安全かつ柔軟に扱うため、`@nestjs/config` と `dotenv-flow` を導入します。
環境ごとの切り替え（development/devcontainer/production）を自動化し、型安全な設定管理を実現します。

## 📂 この章で作成・修正するファイル

この章の作業完了時には、以下のディレクトリ構成となります。

```text
.
├── .env (新規作成)
├── .env.development (新規作成)
├── .env.production (新規作成)
├── .env.devcontainer (新規作成)
├── .gitignore (修正)
├── package.json (修正)
└── src/
    ├── config/
    │   ├── configuration.ts (新規作成)
    │   ├── validation.ts (新規作成)
    │   └── index.ts (新規作成)
    ├── app.module.ts (修正)
    ├── main.ts (修正)
    ├── app.controller.ts (削除)
    ├── app.controller.spec.ts (削除)
    └── app.service.ts (削除)
```

---

## 🛠️ 構築手順

### 1. 必要なパッケージのインストール

設定管理とバリデーション（値の検証）に必要なライブラリを導入します。

```bash
# NestJS公式の設定モジュール
npm install --save @nestjs/config

# バリデーション用ライブラリ
npm install --save joi
npm install --save-dev @types/joi

# 環境別の.env管理用ライブラリ
npm install dotenv-flow
npm install --save-dev @types/dotenv-flow
```

### 2. 不要ファイルの削除

初期状態で生成されているサンプルファイルを削除します。

```bash
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

### 3. Git管理設定の調整

`.env` ファイルを共有リポジトリで管理するため、`.gitignore` を修正します。

```diff
# .gitignore
- .env
+ # .env (プロジェクトの共通設定として管理する場合)
```

### 4. 環境変数の定義

各環境ごとの `.env` ファイルをルートディレクトリに作成します。

#### `.env` (共通)

```sh
PORT=3000
DB_PORT=5432
DB_NAME=myapp
```

#### `.env.production` (本番環境用)

```sh
DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=superpass
```

#### `.env.development` (開発環境用)

```sh
DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devspass
```

#### `.env.devcontainer` (コンテナ開発用)

```sh
DB_HOST=db
DB_USER=devuser
DB_PASS=devpass
```

### 5. Config 実装

#### `src/config/validation.ts`

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

#### `src/config/configuration.ts`

※ `export const configuration` とすることで、再エクスポートを容易にします。

```ts
export const configuration = () => ({
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

#### `src/config/index.ts`

名前付きエクスポートをすべて再エクスポートします。

```ts
export * from './configuration';
export * from './validation';
```

#### `src/app.module.ts`

`ignoreEnvFile: true` を設定し、NestJS 標準の `.env` 読み込み機能を無効化します。

> **💡 なぜ `ignoreEnvFile: true` にするのか？**
> NestJS 標準の機能では単一の `.env` 読み込みに限定されます。今回は `dotenv-flow` を利用して `.env.development` や `.env.devcontainer` などの複数ファイルを環境に応じて動的に切り替えたいため、NestJS 側の重複読み込みによる競合を防ぐ目的で無効化しています。

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration, validationSchema } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
```

#### `src/main.ts`

```ts
import 'dotenv-flow/config';
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

### 6. スクリプトの修正 (`package.json`)

DevContainer 環境でアプリケーションを実行する際、常に `.env.devcontainer` が読み込まれるよう、起動スクリプトの先頭に `NODE_ENV=devcontainer` を付与します。

これにより、コンテナ内の DB 接続設定などが自動的に適用されます。

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

---

## ✅ 完了確認

- [ ] `npm run start:dev` で正常に起動すること
- [ ] ターミナルにバリデーションエラーが表示されていないこと（`.env.devcontainer` の内容が正しく検証されていること）

## 📝 参照

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [dotenv-flow GitHub](https://github.com/kerimdzhanov/dotenv-flow)
