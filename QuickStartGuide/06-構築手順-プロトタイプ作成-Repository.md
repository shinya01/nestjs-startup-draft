# 06-構築手順-プロトタイプ作成-Repository

## 🎯 目的

TypeORM の `Repository` をラップした独自のリポジトリ層を導入し、データアクセスロジックを共通化します。
これにより、サービス層からのデータベース操作をシンプルにし、保守性とテストのしやすさを向上させます。

## 📂 この章で作成・修正するファイル

作業完了時には、以下のディレクトリ構成となります。

```text
src/
├── common/
│   ├── entities/ (既存)
│   ├── repositories/ (新規作成)
│   │   ├── article.repository.ts
│   │   ├── user.repository.ts
│   │   ├── user-info.repository.ts
│   │   └── index.ts
│   └── common.module.ts (新規作成)
└── app.module.ts (修正)
```

---

## 🛠️ 構築手順

### 1. 各 Repository の作成

ドメインごとにデータアクセス用のメソッドを定義したクラスを作成します。

#### `src/common/repositories/user.repository.ts`

※ `articles` は OneToMany のため、デフォルトの取得対象から除外しています。

```ts
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
    // articles は含めず、OneToOne の info のみ取得
    return this.repo.find({ relations: ['info'] });
  }

  findById(id: number): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['info'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      relations: ['info'],
    });
  }

  findByExternalId(externalId: string): Promise<User | null> {
    return this.repo.findOne({
      where: { externalId }, // externalId で検索
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

#### `src/common/repositories/user-info.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInfo } from '../entities/user-info.entity';

@Injectable()
export class UserInfoRepository {
  constructor(
    @InjectRepository(UserInfo)
    private readonly repo: Repository<UserInfo>,
  ) {}

  findAll(): Promise<UserInfo[]> {
    return this.repo.find({ relations: ['user'] });
  }

  findById(id: number): Promise<UserInfo | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  save(info: Partial<UserInfo>): Promise<UserInfo> {
    return this.repo.save(info);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

#### `src/common/repositories/article.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../entities';

@Injectable()
export class ArticleRepository {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
  ) {}

  findAll(): Promise<Article[]> {
    return this.repo.find({ relations: ['author'] });
  }

  findById(id: number): Promise<Article | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
  }

  save(article: Partial<Article>): Promise<Article> {
    return this.repo.save(article);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

### 2. Repository のエクスポート設定 (Barrelファイル)

他のモジュールから一括で扱えるよう、`index.ts` を作成します。

#### `src/common/repositories/index.ts`

```ts
import { UserRepository } from './user.repository';
import { UserInfoRepository } from './user-info.repository';
import { ArticleRepository } from './article.repository';

export const REPOSITORIES = [
  UserRepository,
  UserInfoRepository,
  ArticleRepository,
];

export * from './user.repository';
export * from './user-info.repository';
export * from './article.repository';
```

### 3. CommonModule の作成と登録

Entity と Repository を管理する `CommonModule` を作成します。

#### `src/common/common.module.ts`

```ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './entities';
import { REPOSITORIES } from './repositories';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: [...REPOSITORIES],
  exports: [...REPOSITORIES],
})
export class CommonModule {}
```

### 4. AppModule への登録

作成した `CommonModule` を `AppModule` の `imports` に追加します。

#### `src/app.module.ts`

```ts
// ... 既存の import
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // ... 既存の設定
    CommonModule,
  ],
})
export class AppModule {}
```

---

## ✅ 実装イメージ（Service 層での注入例）

`CommonModule` を `@Global()` に設定しているため、各機能モジュールで再度 import することなく、コンストラクタで注入するだけで Repository を利用できます。

```ts
// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { UserRepository } from '../common/repositories';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getUsers() {
    return this.userRepo.findAll();
  }
}
```

---

## 📌 補足ポイント

- **リレーションの制御**: `User` から `Article` (OneToMany) を取得するとデータ肥大化の原因になるため、リポジトリ層で適切に `relations` を制御しています。
- **`@Global()` の使用**: プロジェクト全体で共通のリポジトリ層を利用可能にしています。
- **テストの容易性**: Repository クラスを DI することで、Service の単体テスト時にモック化が容易になります。

## 📝 参照

- [NestJS Database: Repository Pattern](https://docs.nestjs.com/techniques/database#repository-pattern)
