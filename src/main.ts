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
