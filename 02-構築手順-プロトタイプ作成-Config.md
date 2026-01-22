この構成をもとにConfig設定
```text
src/
├── main.ts
├── app.module.ts
├── config/              # 設定ファイル（.env読み込み）
│   ├── .env.common
│   └── .env.development
├── common/              # 共通ユーティリティ・デコレーター・フィルターなど
│   ├── filters/
│   ├── interceptors/
│   ├── decorators/
│   └── utils/
├── core/                # 認証・DB接続などアプリ全体の基盤
│   ├── auth/
│   └── database/
├── modules/             # 機能ごとのモジュール（ドメイン単位）
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── posts/
│   └── comments/
└── shared/              # 他モジュールと共有されるサービスや型
    ├── guards/
    ├── pipes/
    └── interfaces/
```

```bash
npm i --save @nestjs/config
npm i --save joi
npm i --save-dev @types/joi
```


app.controller.ts、app.controller.spec.tsはサンプルなので削除。

Configの設定
- isGlobal: true (default) どのモジュールでも ConfigService を使えるようにする
- load	環境変数を構造化して扱いやすくする。。ConfigService.get('group.key') で構造化アクセス。

.envをgitignoreから除外する。
dotenv-flowを使う。

```bash
npm install dotenv-flow
npm install -D @types/dotenv-flow
```

例：NODE_ENV=development のとき
読み込み順はこうなる：
.env
.env.local
.env.development
.env.development.local
でも、後から読み込んだものが優先されるから、
最終的な優先度は：
.env.development.local > .env.development > .env.local > .env

NODE_ENV=production DB_HOST=override.example.com node main.js
このように コマンドラインや OS 側で指定された環境変数は、
.env 系のどんな値よりも優先されて、絶対に上書きされない。


```TypeScript
// main.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config(); // ← これが最初！

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```


```TypeScript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // ← dotenv-flowで読み込むので、NestJSでは読み込まない！
      load: [configuration],
    }),
  ],
})
export class AppModule {}
```

```TypeScript
// src/config/validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
});
```

```TypeScript
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

.env.common
```
# アプリケーション設定
NODE_ENV=development
PORT=3000

# データベース（デフォルトはローカル）
DB_PORT=5432
DB_NAME=myapp

# JWT設定
JWT_SECRET=changeme
JWT_EXPIRES_IN=1h
```

.env.development
```
# 開発用にポートを変えたい場合
PORT=4000

# ローカルDBの別インスタンスを使いたい場合
DB_HOST=dev.db.example.com
DB_USER=devuser
DB_PASS=devpass

# 開発用のJWT設定
JWT_SECRET=devsecret
```

.env.production
```
NODE_ENV=production
PORT=8080

DB_HOST=prod.db.example.com
DB_USER=produser
DB_PASS=supersecret

JWT_SECRET=ultrasecret
JWT_EXPIRES_IN=15m
```

.env.devcontainer
```
# アプリケーション設定
NODE_ENV=development
PORT=3000

# データベース（デフォルトはローカル）
DB_HOST=db
DB_USER=devuser
DB_PASS=devpass

# JWT設定
JWT_SECRET=changeme
JWT_EXPIRES_IN=1h
```

package.jsonのscriptsのstartに`NODE_ENV=devcontainer`を追加。
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