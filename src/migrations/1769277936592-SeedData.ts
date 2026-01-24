import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedData1769153762506 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "user" (id, name, email, password)
      VALUES
        (1, 'ミカ', 'mica@fox.jp', 'secret1'),
        (2, 'エリン', 'erin@forest.jp', 'secret2'),
        (3, 'アクア', 'aqua@river.jp', 'secret3');
    `);

    await queryRunner.query(`
      INSERT INTO "article" (title, content, "authorId")
      VALUES
        ('はじめてのNestJS', 'NestJSはとっても楽しい！', 1),
        ('PostgreSQL入門', 'データベースの基本を学ぼう！', 2);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "article"`);
    await queryRunner.query(`DELETE FROM "user"`);
  }
}
