import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;
  console.log(port);
  await app.listen(port);
}
void bootstrap();
