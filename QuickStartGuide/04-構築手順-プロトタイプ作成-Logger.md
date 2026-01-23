# 04-構築手順 - プロトタイプ作成 - Logger

## 🔊 高速ロガー `pino` の導入

[pino](https://github.com/pinojs/pino) は超高速＆高機能な Node.js ロガー！  
ECS × NestJS × JSONログの構成に最適で、CloudWatch・Datadog・Fluent Bit との連携にも強い！

### 📦 必要なパッケージのインストール

```bash
npm install pino pino-pretty
npm install --save nestjs-pino
```

> 💡 `pino-pretty` は **開発環境専用**！本番環境では使用しないように注意！

---

## ⚙️ AppModule に LoggerModule を追加

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { LoggerModule } from 'nestjs-pino';

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
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.user'),
        password: config.get('database.pass'),
        database: config.get('database.name'),
        entities: [__dirname + '/common/entities/*.entity{.ts,.js}'],
        synchronize: config.get('database.synchronize'),
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
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
  ],
})
export class AppModule {}
```

> 💡 `pino-pretty` を使うことで、開発中は見やすいログ出力に！  
> 本番では JSON ログが出力され、ログ収集ツールと連携しやすくなるよ！

---

## 🚀 `main.ts` の設定

```ts
// main.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // nestjs-pino のロガーを使用
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;

  await app.listen(port);
}
void bootstrap();
```

> 💡 `bufferLogs: true` を指定することで、ロガーが初期化される前のログもバッファリングされて出力されるよ！

---

## 📘 補足

- `nestjs-pino` は NestJS に自然に統合できるロガーモジュールで、**DI（依存性注入）対応**。
- `Logger` クラスを使えば、**サービスやコントローラー内でも簡単にログ出力**できるよ！

```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SampleService {
  private readonly logger = new Logger(SampleService.name);

  doSomething() {
    this.logger.log('何か処理を実行しました');
  }
}
```

---

これでロギングの基盤もバッチリ整ったよ！  
本番環境でも開発環境でも、**見やすくて扱いやすいログ**が出力されるようになるから、運用も安心だね！🌈💧
