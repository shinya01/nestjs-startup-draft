import { UserRepository } from './user.repository';

export const REPOSITORIES = [UserRepository]; // 他のリポジトリもここに追加
export { UserRepository }; // 個別インポート用にもエクスポート
