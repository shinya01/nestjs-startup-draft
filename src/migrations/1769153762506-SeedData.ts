import { User } from '../common/entities';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedData1769153762506 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.insert(User, [
      { name: 'ミカ', email: 'mica@fox.jp' },
      { name: 'エリン', email: 'erin@forest.jp' },
      { name: 'アクア', email: 'aqua@river.jp' },
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.delete(User, [
      { email: 'mica@fox.jp' },
      { email: 'erin@forest.jp' },
      { email: 'aqua@river.jp' },
    ]);
  }
}
