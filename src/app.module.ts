import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.local`, // ← ローカル環境用
        `.env.${process.env.NODE_ENV || 'development'}`, // ← 環境ごとの上書き
        '.env', // ← デフォルト値
      ],
      load: [configuration],
      validationSchema,
    }),
  ],
})
export class AppModule {}
