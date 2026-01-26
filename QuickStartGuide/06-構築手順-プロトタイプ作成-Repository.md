# 06-構築手順 - プロトタイプ作成 - Repository

## 🧱 Repository パターンの導入

TypeORM の `Repository` をラップして、ドメインごとのデータアクセスを整理する構成を作成。  
Service 層との責務分離やテストのしやすさが向上。

---

## 📁 ディレクトリ構成

```txt
src/
├── common/
│   ├── repositories/
│   │   ├── article.repository.ts
│   │   ├── user.repository.ts
│   │   ├── user-info.repository.ts
│   │   └── index.ts
│   └── common.module.ts
```

---

## 📦 `UserRepository` の作成

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

  findByExternalId(externalId: string): Promise<User | null> {
    return this.repo.findOne({
      where: { externalId },
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

---

## 📦 `UserInfoRepository` の作成

```ts
// src/common/repositories/user-info.repository.ts
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

---

## 📦 `ArticleRepository` の作成

```ts
// src/common/repositories/article.repository.ts
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

---

## 🧩 Repository のエクスポート設定

```ts
// src/common/repositories/index.ts
import { UserRepository } from './user.repository';
import { UserInfoRepository } from './user-info.repository';
import { ArticleRepository } from './article.repository';

export const REPOSITORIES = [
  UserRepository,
  UserInfoRepository,
  ArticleRepository,
];

export {
  UserRepository,
  UserInfoRepository,
  ArticleRepository,
};
```

---

## 🧱 `CommonModule` への登録

```ts
// src/common/common.module.ts
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
```

> 💡 `TypeOrmModule.forFeature()` により、指定した Entity の Repository を NestJS の DI コンテナに登録可能。

---

## ✅ 使用例（Service 層での注入）

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

- Repository をラップすることで、複雑なクエリやトランザクション処理を集約可能  
- テスト時にモックを差し替えやすくなり、ユニットテストの記述が容易  
- 複数の Entity に対応する場合は、`REPOSITORIES` に追加するだけで拡張が可能  

## 📝 参照

- <https://docs.nestjs.com/techniques/database#repository-pattern>
