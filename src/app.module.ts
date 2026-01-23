import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // ← dotenv-flow で読み込むので NestJS 側では読み込まない
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
