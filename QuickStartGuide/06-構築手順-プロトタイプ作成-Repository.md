# 06-構築手順 - プロトタイプ作成 - Repository

## 🧱 Repository パターンの導入

TypeORM の `Repository` をラップして、**ドメインごとのデータアクセスを整理**する構成を作成するよ。  
これにより、Service 層との責務分離やテストのしやすさがグッと向上する！

---

## 📁 ディレクトリ構成

```
src/
├── common/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── repositories/
│   │   ├── user.repository.ts
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
    return this.repo.find();
  }

  findById(id: number): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  save(user: Partial<User>): Promise<User> {
    return this.repo.save(user);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

> 💡 `Partial<User>` を使うことで、更新や作成時に一部のプロパティだけ渡すことができるよ！

---

## 🧩 Repository のエクスポート設定

```ts
// src/common/repositories/index.ts
import { UserRepository } from './user.repository';

export const REPOSITORIES = [UserRepository]; // 他のリポジトリもここに追加
export { UserRepository }; // 個別インポート用にもエクスポート
```

---

## 🧱 `CommonModule` に登録

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

> 💡 `TypeOrmModule.forFeature()` によって、指定した Entity の Repository を NestJS の DI コンテナに登録できるよ！

---

## ✅ 使用例（Service などでの注入）　※この後の手順でやります。

```ts
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

- Repository をラップすることで、**複雑なクエリやトランザクション処理も集約**できる！
- テスト時にモックを差し替えやすくなるため、**ユニットテストが書きやすくなる！**
- 複数の Entity に対応する場合は、`REPOSITORIES` に追加していくだけで拡張も簡単！

---

これで Repository パターンの基盤が整ったよ！📦✨  
今後は `PostRepository` や `CommentRepository` など、同じパターンでどんどん拡張していけるね！  
必要なら Service 層や UseCase 層との連携も一緒に整えていこう〜！💧
