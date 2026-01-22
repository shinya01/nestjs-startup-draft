この構成をもとにConfig設定
```
src/
├── main.ts
├── app.module.ts
├── config/              # 設定ファイル（.env読み込み）
│   ├── .env
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

```
npm i --save @nestjs/config
npm i --save joi
npm i --save-dev @types/joi

```


-「共通設定 + 環境ごとの上書き」
- 設定ファイルはyaml (.envは利用しない)

app.controller.ts、app.controller.spec.tsはサンプルなので削除。

Configの設定
- isGlobal: true (default) どのモジュールでも ConfigService を使えるようにする
- load	環境変数を構造化して扱いやすくする。。ConfigService.get('group.key') で構造化アクセス。

```
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.local`, // ← ローカル環境用
        `.env.${process.env.NODE_ENV || 'development'}`, // ← 環境ごとの上書き
        '.env', // ← デフォルト値
      ],
      load: [configuration],
    }),
  ],
})
export class AppModule {}
```

```
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