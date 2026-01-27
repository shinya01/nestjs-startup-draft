# 06-構築手順 - プロトタイプ作成 - Repository

## 🧱 Repository パターンの導入

TypeORM の標準 `Repository` をそのまま使用するのではなく、独自の `Repository` クラスでラップ（隠蔽）する構成を採用します。
これにより、以下のメリットが得られます。

- **責務の明確化**: Service層がデータベースの特定のクエリビルド（TypeORMの関数）を意識しなくて済むようになります。
- **テストの容易性**: データベースを実際に動かさなくても、Repositoryのモックを作成するだけでServiceのテストが可能になります。
- **共通クエリの集約**: 「論理削除されていないデータのみ取得」といった共通条件を一箇所に閉じ込めることができます。

---

## 📁 ディレクトリ構成

```txt
src/
├── common/
│   ├── entities/          # 第3章で作成
│   ├── repositories/      # 今回作成
│   │   ├── article.repository.ts
│   │   ├── user.repository.ts
│   │   ├── user-info.repository.ts
│   │   └── index.ts
│   └── common.module.ts   # Repositoryを管理するモジュール
```

---

## 📦 各 Repository の実装

### 1. UserRepository

```ts
// src/common/repositories/user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find({ relations: ['info', 'articles'] });
  }

  findById(id: number): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['info', 'articles'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      relations: ['info'],
    });
  }

  save(user: Partial<User>): Promise<User> {
    return this.repo.save(user);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

### 2. UserInfoRepository / ArticleRepository

同様に、他の Entity についても `save`, `findAll`, `findById`, `delete` などの基本操作を実装します。

---

## 🧱 CommonModule への登録

作成した Repository を他の Module で利用できるようにエクスポートします。

```ts
// src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './entities';
import { REPOSITORIES } from './repositories';

@Global() // プロジェクト全体で利用する場合は Global にすると便利
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [...REPOSITORIES],
  exports: [...REPOSITORIES],
})
export class CommonModule {}
```

---

## 🧩 アプリケーションへの統合 (AppModule)

`AppModule` に `CommonModule` を追加して、DI コンテナで Repository を管理できるようにします。

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
// ...他のインポート

@Module({
  imports: [
    // ...ConfigModule, TypeOrmModule
    CommonModule,
  ],
})
export class AppModule {}
```

---

## ✅ 実装のポイントと使用例

Service 層で Repository を注入して使用します。

```ts
// src/user/user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async fetchAllUsers() {
    // TypeORMの find() メソッドではなく、自分たちが定義した findAll() を呼ぶ
    return this.userRepo.findAll();
  }
}
```

### 📌 運用アドバイス

- **クエリの複雑化**: `QueryBuilder` を使うような複雑な結合クエリが必要になった際も、Repositoryクラス内に記述することで、Service層の可読性を保てます。
- **リレーションの制御**: `relations: [...]` の指定を Repository 側に持たせることで、データの取得漏れを防げます。

---

## 📝 参照

- [NestJS Database Guide](https://docs.nestjs.com/techniques/database#repository-pattern)
- [TypeORM Repository API](https://typeorm.io/repository-api)
