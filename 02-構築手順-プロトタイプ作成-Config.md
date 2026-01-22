この構成をもとにConfig設定
```
src/
├── main.ts
├── app.module.ts
├── config/              # 設定ファイル（YAMLや.env読み込み）
│   ├── configuration.ts
│   ├── default.yaml
│   └── development.yaml
├── common/              # 共通ユーティリティ・デコレーター・フィルターなど
│   ├── filters/
│   ├── interceptors/
│   ├── decorators/
│   └── utils/
├── core/                # 認証・DB接続などアプリ全体の基盤
│   ├── auth/
│   └── database/
├── modules/             # 機能ごとのモジュール（ドメイン単位）
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── posts/
│   └── comments/
└── shared/              # 他モジュールと共有されるサービスや型
    ├── guards/
    ├── pipes/
    └── interfaces/
```

-「共通設定 + 環境ごとの上書き」
- 設定ファイルはyaml (.envは利用しない)

