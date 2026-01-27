# 07-構築手順 - プロトタイプ作成 - Module構成とバリデーション

## 🎯 目的

NestJS のモジュール構成、DTO による入出力バリデーション、および `typeorm-transactional` による宣言的トランザクションを導入し、堅牢なビジネスロジックの実装基盤を構築します。

---

## 📦 必要パッケージのインストール

```bash
# トランザクション管理
npm install typeorm-transactional
# バリデーション & クラス変換
npm install class-validator class-transformer
```

---

## ⚙️ トランザクションとバリデーションのグローバル設定

### 1. main.ts の修正

トランザクションコンテキストの初期化と、`ValidationPipe` の適用を行います。

```ts
// src/main.ts
import { initializeTransactionalContext, StorageDriver } from 'typeorm-transactional';
import { ValidationPipe } from '@nestjs/common';
// ...他のインポート

async function bootstrap() {
  // 1. トランザクション初期化（必ず NestFactory.create の前に行う）
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // 2. DTO バリデーションのグローバル適用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,   // DTOにないプロパティを自動除外
      transform: true,   // 文字列から数値などの型変換を自動化
      forbidNonWhitelisted: true, // 定義外のプロパティがある場合にエラーを返す（より厳格にする場合）
    }),
  );

  // ...Swagger設定など
}
void bootstrap();
```

### 2. AppModule の修正（DataSource の拡張）

`TypeOrmModule` に `dataSourceFactory` を追加し、トランザクションを有効化します。

```ts
// src/app.module.ts
import { addTransactionalDataSource } from 'typeorm-transactional';
// ...

TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    // ...DB接続設定
  }),
  dataSourceFactory: async (options) => {
    if (!options) throw new Error('Invalid options');
    return addTransactionalDataSource(new DataSource(options));
  },
  inject: [ConfigService],
}),
```

---

## 🧱 DTO (Data Transfer Object) の定義

「入力（Request）」と「出力（Response）」の型を明確に分け、セキュリティとドキュメント性を向上させます。

### Response 用 DTO (例: UserDto)

`@Expose()` を使うことで、エンティティ内のパスワードなどを除外した「見せても良い項目」のみを定義します。

```ts
// src/user/dto/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class UserDto {
  @ApiProperty() @Expose() id: number;
  @ApiProperty() @Expose() email: string;

  @ApiProperty({ type: () => UserInfoDto, nullable: true })
  @Expose()
  @Type(() => UserInfoDto)
  info?: UserInfoDto | null;
}
```

### Request 用 DTO (例: CreateUserDto)

`class-validator` デコレータで入力値のルールを定義します。

```ts
// src/user/dto/request/create-user.dto.ts
import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '田中 太郎' })
  @IsNotEmpty()
  @Length(2, 50)
  name: string;
}
```

---

## 🛠️ Service 層の実装（ビジネスロジックとトランザクション）

`@Transactional()` を付与するだけで、メソッド内の複数リポジトリ操作が 1 トランザクションになります。

```ts
// src/user/user.service.ts
import { Transactional } from 'typeorm-transactional';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly userInfoRepo: UserInfoRepository,
  ) {}

  @Transactional()
  async create(data: CreateUserDto): Promise<UserDto> {
    // ユーザー作成
    const user = await this.userRepo.save({ email: data.email });
    
    // 付随情報の作成（ここでもしエラーが起きればユーザー作成もロールバックされる）
    await this.userInfoRepo.save({ name: data.name, user });
    
    const created = await this.userRepo.findById(user.id);
    return plainToInstance(UserDto, created, { excludeExtraneousValues: true });
  }
}
```

---

## 🎮 Controller 層の実装

`ValidationPipe` の `transform: true` 設定により、パスパラメータ（id）は自動的に `number` へ変換されます。

```ts
// src/user/user.controller.ts
@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @ApiOperation({ summary: 'IDでユーザーを取得' })
  getById(@Param('id') id: number) { // 自動で数値に変換される
    return this.userService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'ユーザーを作成' })
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }
}
```

---

## ✅ 補足ポイント

- **型変換の自動化**: `ValidationPipe` のおかげで、`Param` や `Query` のパース処理（`parseInt` 等）を記述する必要がなくなります。
- **データ隠蔽**: `class-transformer` を通すことで、API レスポンスに不要な内部データ（`password_hash` や `version` 等）が漏れるのを防ぎます。
- **トランザクションの簡素化**: `QueryRunner` を直接操作する複雑なコードが不要になり、Service 層が読みやすくなります。

---

## 📝 参照

- [TypeORM Transactional (GitHub)](https://github.com/Aliheym/typeorm-transactional)
- [NestJS Validation Pipe](https://docs.nestjs.com/techniques/validation)
