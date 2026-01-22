```
src/
├── common/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── repositories/
│   │   └── user.repository.ts
│   └── common.module.ts
├── user/
│   ├── dto/
│   │   └── create-user.dto.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
```

common/repositories/user.repository.ts
```TypeScript
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

  findAll() {
    return this.repo.find();
  }

  findById(id: number) {
    return this.repo.findOneBy({ id });
  }

  save(user: Partial<User>) {
    return this.repo.save(user);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
```

```TypeScript
// common/repositories/index.ts
import { UserRepository } from './user.repository';

export const REPOSITORIES = [UserRepository]; // Add other repositories as needed
export { UserRepository }; // Export other repositories as needed
```

common/common.modules.ts
```TypeScript
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
```

