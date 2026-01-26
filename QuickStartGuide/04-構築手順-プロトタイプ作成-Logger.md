# 04-構築手順 - プロトタイプ作成 - Logger

## 🔊 高速ロガー `pino` の導入

[pino](https://github.com/pinojs/pino) は超高速かつ高機能な Node.js ロガー。  
ECS × NestJS × JSON ログの構成に最適で、CloudWatch・Datadog・Fluent Bit との連携にも強みを発揮。

---

## 📦 必要パッケージのインストール

```bash
npm install pino pino-pretty
npm install --save nestjs-pino
```

> 💡 `pino-pretty` は開発環境専用。本番環境では使用しない構成を推奨。

---

## ⚙️ AppModule への LoggerModule の追加

AppModuleにLoggerModuleを追加する。

```ts
// src/app.module.ts
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
      ignoreEnvFile: true, // dotenv-flow による読み込みのため NestJS 側では無効化
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
        logging: config.get('app.env') !== 'production', // 本番環境ではログを無効化
        synchronize: false, // 自動同期を無効化
      }),
      inject: [ConfigService],
    }),
    // Logger の設定を非同期で読み込む
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
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

> 💡 `pino-pretty` により、開発中は見やすいログ出力が可能。  
> 本番環境では JSON ログが出力され、ログ収集ツールとの連携が容易。

---

## 🚀 `main.ts` の設定

```ts
// src/main.ts
import 'dotenv-flow/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // nestjs-pino のロガーを使用するため bufferLogs: true を指定
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // nestjs-pino のロガーをアプリケーションのロガーとして設定
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
void bootstrap();
```

> 💡 `bufferLogs: true` により、ロガー初期化前のログもバッファリングして出力。

---

## 🧩 サービス内でのログ出力

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

## ✅ 補足ポイント

- `nestjs-pino` は NestJS に自然に統合できるロガーモジュール  
- DI（依存性注入）に対応し、サービスやコントローラー内でも簡単にログ出力が可能  
- 開発環境では整形されたログ、本番環境では JSON ログを出力する構成が実現可能  

---

## 📝 参照

- <https://docs.nestjs.com/techniques/logger>
- <https://github.com/pinojs/pino>
- <https://github.com/pinojs/pino-pretty>
