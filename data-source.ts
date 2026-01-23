// data-source.ts
import * as dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

import { DataSource } from 'typeorm';
import configuration from './src/config/configuration';

const db = configuration().database;

export default new DataSource({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.user,
  password: db.pass,
  database: db.name,
  entities: ['src/common/entities/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
