```bash
npm install --save @nestjs/swagger
```

`.env`に`SWAGGER_XXXXX`追加。
```
SWAGGER_TITLE=My Awesome API
SWAGGER_DESCRIPTION=This is the best API sever.
SWAGGER_VERSION=1.0.0
SWAGGER_PORT=8080


# アプリケーション設定
PORT=3000

# データベース（デフォルトはローカル）
DB_PORT=5432
DB_NAME=myapp

# JWT設定
JWT_SECRET=changeme
JWT_EXPIRES_IN=1h
```

swagger追加
```TypeScript
// src/config/configuration.ts
export default () => ({
  swagger: {
    title: process.env.SWAGGER_TITLE,
    description: process.env.SWAGGER_DESCRIPTION,
    version: process.env.SWAGGER_VERSION,
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    name: process.env.DB_NAME,
    synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  },
});
```

swagger追加
```TypeScript
// src/config/validation.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'devcontainer')
    .default('development'),
  PORT: Joi.number().default(3000),
  SWAGGER_TITLE: Joi.string().required(),
  SWAGGER_DESCRIPTION: Joi.string().required(),
  SWAGGER_VERSION: Joi.string().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  TYPEORM_SYNCHRONIZE: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
});
```

swagger追加
```TypeScript
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

  const config = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || '')
    .setDescription(configService.get<string>('swagger.description') || '')
    .setVersion(configService.get<string>('swagger.version') || '')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  const port = configService.get<number>('PORT') || 3000;
  console.log(port);
  await app.listen(port);
}
void bootstrap();
```