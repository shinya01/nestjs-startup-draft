# 04-構築手順-プロトタイプ作成-Logger

## 🎯 目的

アプリケーションの動作状況を把握するため、高速なロガーである `pino` を導入します。
開発環境では人間が見やすい整形ログ（pino-pretty）を出力し、本番環境では構造化された JSON ログを出力することで、CloudWatch や Datadog 等の監視ツールとの親和性を高めます。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
.
├── src/
│   ├── app.module.ts (修正)
│   └── main.ts (修正)
└── package.json (修正: 依存ライブラリ追加)
```

---

## 🛠️ 構築手順

### 1. 必要パッケージのインストール

`pino` 本体と NestJS 統合用のモジュール、および開発用整形ライブラリをインストールします。

```bash
npm install pino pino-pretty
npm install --save nestjs-pino
```

> 💡 `pino-pretty` は開発環境専用です。本番環境ではパフォーマンス向上のため JSON 形式で直接出力します。

### 2. AppModule への LoggerModule の追加

`LoggerModule` を非同期で初期化し、環境変数に応じてログレベルや出力形式を切り替える設定を行います。

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { configuration, validationSchema } from './config';
import { ENTITIES } from './common/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.pass'),
        database: config.get<string>('database.name'),
        entities: ENTITIES,
        logging: config.get('app.env') !== 'production',
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    // Logger の設定を非同期で読み込む
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          // 本番環境は info 以上、開発環境は debug 以上のログを出力
          level: config.get('app.env') === 'production' ? 'info' : 'debug',
          transport:
            config.get('app.env') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 3. `main.ts` の設定

NestJS 標準のロガーを `nestjs-pino` に差し替えます。

```ts
// src/main.ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // Logger 初期化までのログを保持するため bufferLogs: true を指定
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  // アプリケーション全体のロガーを nestjs-pino に差し替え
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

> **💡 なぜ `bufferLogs: true` にするのか？**
> NestJS の起動プロセス（モジュールのロードなど）中に発生するログをメモリ内にバッファリングし、`pino` ロガーが準備できたタイミングで一括出力するためです。これにより、起動直後のログも `pino` の形式で記録されます。

---

## 🧩 実装例：サービス内でのログ出力

サービスやコントローラー内でログを出力する場合は、NestJS 標準の `Logger` クラスをインスタンス化して使用します。内部的に `pino` が呼び出されます。

```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SampleService {
  // クラス名を指定することで、ログのコンテキストに表示される
  private readonly logger = new Logger(SampleService.name);

  doSomething() {
    this.logger.log('処理を開始しました');
    this.logger.debug('詳細なデバッグ情報');
    this.logger.error('エラーが発生した場合');
  }
}
```

---

## ✅ 完了確認

- [ ] `npm run start:dev` を実行し、ターミナルに色付けされた整形ログが表示されること
- [ ] `http://localhost:3000` へのアクセス時、HTTP リクエストログ（メソッド、パス、レスポンスタイム等）が出力されること

## 📝 参照

- [NestJS Logger](https://docs.nestjs.com/techniques/logger)
- [Pino GitHub](https://github.com/pinojs/pino)
- [nestjs-pino GitHub](https://github.com/iamolegga/nestjs-pino)
