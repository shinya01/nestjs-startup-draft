# 04-構築手順 - プロトタイプ作成 - Logger

## 🔊 高速ロガー `pino` の導入

[pino](https://github.com/pinojs/pino) は超高速かつ低コストな Node.js 用ロガーです。
NestJS 標準ロガーを `pino` に差し替えることで、以下のメリットを享受できます。

- **構造化ログ**: 標準で JSON 形式を出力するため、CloudWatch や Datadog での解析が容易。
- **高パフォーマンス**: 出力時のオーバーヘッドが極めて少ない。
- **開発者体験**: `pino-pretty` により、開発中は色付きの読みやすいログを確認可能。

---

## 📦 必要パッケージのインストール

```bash
npm install nestjs-pino pino pino-http
npm install --save-dev pino-pretty
```

---

## ⚙️ AppModule への LoggerModule 導入

`LoggerModule.forRootAsync` を使用し、環境設定（`app.env`）に応じて出力形式を動的に切り替えます。

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
// ... 他のインポート（TypeOrmModule, ENTITIES等）

@Module({
  imports: [
    // ... ConfigModule, TypeOrmModule の設定
    
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('app.env') === 'production';
        return {
          pinoHttp: {
            // 本番は info 以上、開発環境は debug レベルまで出力
            level: isProduction ? 'info' : 'debug',
            // 開発環境のみ pino-pretty を有効化
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            // ログから除外したいリクエストヘッダー（セキュリティ対策）
            redact: isProduction ? ['req.headers.authorization', 'req.headers.cookie'] : [],
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## 🚀 main.ts の設定

NestJS の起動ログも含めて `pino` で出力するために、初期化オプションを変更します。

```ts
// src/main.ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // 1. ロガー初期化前のログをバッファリングする
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // 2. nestjs-pino を標準ロガーとしてアプリ全体に適用
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  
  await app.listen(port);
}
void bootstrap();
```

---

## 🧩 クラス内での利用方法

`nestjs-pino` を導入しても、NestJS 標準の `Logger` インターフェース経由で利用できます。これにより、将来的なロガーの差し替えも容易になります。

```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  // クラス名をコンテキストとして渡す
  private readonly logger = new Logger(UserService.name);

  async findAll() {
    this.logger.debug('ユーザー一覧を取得します');
    try {
      // 処理...
    } catch (e) {
      this.logger.error('取得に失敗しました', e.stack);
    }
  }
}
```

---

## ✅ 補足ポイント

- **HTTPリクエストログ**: `nestjs-pino` は、リクエストの開始から終了（ステータスコード、レスポンスタイム）までを自動でログ出力してくれます。
- **自動バッファリング**: `bufferLogs: true` を指定することで、AppModule の初期化（DB接続など）のログも漏らさず `pino` 形式で出力されます。
- **本番環境での注意**: `pino-pretty` は非常に CPU リソースを消費するため、本番環境の `transport` 設定には含めないようにします。

---

## 📝 参照

- [NestJS Logger Techniques](https://docs.nestjs.com/techniques/logger)
- [pino - GitHub](https://github.com/pinojs/pino)
- [nestjs-pino - GitHub](https://github.com/iamolegga/nestjs-pino)
