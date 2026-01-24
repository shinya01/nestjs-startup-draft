# 10-構築手順 - RBAC（ロールベースのアクセス制御）(任意)

## 🎯 目的

JWTトークンに含まれるロール情報（例：`cognito:groups`）を使って、  
「管理者だけが使えるAPI」「特定のロールだけがアクセスできる機能」などを制御できるようにするよ！

---

## 🧩 実装の流れ

1. JWTトークンにロール情報を含める（すでに `validate()` で取得済み）
2. `@Roles()` デコレーターを作成
3. `RolesGuard` を作成してロールをチェック
4. Controllerで `@UseGuards()` と `@Roles()` を組み合わせて制御！

---

## 🧾 1. `@Roles()` デコレーターの作成

```ts
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

## 🛡️ 2. `RolesGuard` の作成

```ts
// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const userRoles = user?.roles || [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('アクセス権限がありません');
    }
    return true;
  }
}
```

---

## 🧩 3. `auth.module.ts` に `RolesGuard` を登録

```ts
import { RolesGuard } from './guards/roles.guard';

@Module({
  // ...
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

---

## 🧩 4. Controllerでロール制御を適用

```ts
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') // ← 管理者のみ許可
@ApiOperation({ summary: 'ユーザーを削除（管理者のみ）' })
@ApiForbiddenResponse({ description: '権限がありません' })
remove(@Param() params: UserIdParamDto): Promise<void> {
  return this.userService.remove(params.id);
}
```

---

## ✅ まとめ

この構成で、以下のような制御が可能になるよ！

- `@Roles('admin')` → 管理者のみアクセス可能
- `@Roles('editor', 'admin')` → 編集者または管理者がアクセス可能
- ロールが一致しない場合は `403 Forbidden` を返す

---

## 💡 補足ポイント

- ロール情報はJWTの `cognito:groups` や `roles` クレームに含まれていることが前提だよ！
- `validate()` メソッドで `roles` を `req.user` にセットしておくのを忘れずに！
- Swaggerに `@ApiForbiddenResponse()` を追加しておくと、API仕様がより明確になるよ！

---

これで、**アプリケーションに柔軟なアクセス制御を導入できるRBAC構成が完成！**  
次は「ロールの管理UI」や「ユーザーごとの権限変更機能」なんかも追加していけるね〜！💪💧
