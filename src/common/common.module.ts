// common/common.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './entities';
import { REPOSITORIES } from './repositories';

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [...REPOSITORIES],
  exports: [...REPOSITORIES],
})
export class CommonModule {}
