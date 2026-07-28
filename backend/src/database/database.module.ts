import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

// Kết nối CSDL PostgreSQL/PostGIS cho toàn ứng dụng (ADR-02).
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      retryAttempts: 10,
      retryDelay: 3000,
    }),
  ],
})
export class DatabaseModule {}
