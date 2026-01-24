import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext } from 'typeorm-transactional-cls-hooked';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { ErrorResponseDto } from './common/swagger/error-response.dto';
import { SuccessResponseDto } from './common/swagger';

async function bootstrap() {
  initializeTransactionalContext(); // トランザクションのコンテキスト初期化

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOに定義されていないプロパティを除外
      transform: true, // 型変換を有効化
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter()); // HTTP例外フィルター
  app.useGlobalInterceptors(new ResponseTransformInterceptor()); // レスポンス変換グローバルインターセプター

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'My API')
    .setDescription(
      configService.get<string>('swagger.description') || 'API documentation',
    )
    .setVersion(configService.get<string>('swagger.version') || '1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [SuccessResponseDto, ErrorResponseDto], // 追加のモデルを登録
  });
  SwaggerModule.setup('swagger', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
void bootstrap();
