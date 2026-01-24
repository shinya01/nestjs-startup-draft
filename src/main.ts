// main.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
