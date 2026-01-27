# 02-構築手順 - プロトタイプ作成 - Config (デバッグ対応版)

## 📦 必要なパッケージのインストール

```bash
npm install --save @nestjs/config dotenv-flow joi
npm install --save-dev @types/joi
```

---

## 🧹 不要ファイルの削除

初期ファイルを削除し、`app.module.ts` を後述のコードで上書きします。

- `src/app.controller.ts`, `src/app.controller.spec.ts`, `src/app.service.ts`

---

## ⚙️ ConfigModule と dotenv-flow の統合設計

NestJS で環境ごとの `.env.xxxx` を確実に読み込み、デバッグ可能にするための設定です。

### 1. バリデーションと構造化

```ts
// src/config/validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'devcontainer')
    .default('development'),
  PORT: Joi.number().default(3000),
  // ...DB等の設定
});

// src/config/configuration.ts
export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  // ...
});
```

### 2. AppModule の設定

`ignoreEnvFile: true` にすることで、NestJS 標準機能ではなく `dotenv-flow` に読み込みを委ねます。

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
      ignoreEnvFile: true, 
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
```

---

## 🛠️ デバッグ・実行環境の統合設定

`NODE_ENV` を通じて `.env.devcontainer` などを切り替えるための肝となる設定です。

### 1. package.json の修正

スクリプトに `NODE_ENV` を明示的に付与します。

```json
  "scripts": {
    "start": "NODE_ENV=devcontainer nest start",
    "start:dev": "NODE_ENV=devcontainer nest start --watch",
    "start:debug": "NODE_ENV=devcontainer nest start --debug --watch",
    "start:prod": "NODE_ENV=devcontainer node dist/main",
  },
```

### 2. VS Code launch.json の修正

VS Code からデバッグを開始した際に、`.env.devcontainer` が読み込まれるように `env` プロパティを追加します。

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Nest Framework",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:dev", "--"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "restart": true,
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "devcontainer" 
      }
    }
  ]
}
```

---

## 📑 .env ファイルの作成例

DevContainer 環境で即座に動作するように、以下のファイルを用意します。

### `.env.devcontainer`

```bash
## DevContainer専用設定
PORT=3000
DB_HOST=db
DB_PORT=5432
DB_USER=devuser
DB_PASS=devpass
DB_NAME=sample_db
```

---

## 🚀 動作確認手順

1. **ターミナルでの確認**:
   `npm run start:dev` を実行。`dotenv-flow` が `NODE_ENV=devcontainer` を検知し、`.env.devcontainer` の内容が読み込まれることを確認します。
2. **VS Code デバッグの確認**:
   `F5` キー（またはデバッグパネルから実行）で起動。ブレークポイントで止まること、かつ `configService.get('app.env')` が `"devcontainer"` を返していることを確認します。

---

## 📝 参照

- [dotenv-flow: Multiple .env files](https://github.com/kerimdzhanov/dotenv-flow#node_env-specific-env-files)
- [NestJS: Asynchronous configuration](https://docs.nestjs.com/techniques/configuration#asynchronous-configuration)
