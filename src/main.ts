import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked';

async function bootstrap() {
  initializeTransactionalContext();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);

  const config = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Auth0 access token here',
      },
      'access-token',
    ) // ← この名前を後で使う！
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
