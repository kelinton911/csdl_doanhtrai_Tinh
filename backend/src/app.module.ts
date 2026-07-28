import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './modules/identity/identity.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './modules/identity/guards/jwt-auth.guard';
import { RolesGuard } from './modules/identity/guards/roles.guard';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Nạp .env ở gốc monorepo rồi backend/.env.
      envFilePath: ['../.env', '.env'],
    }),
    DatabaseModule,
    IdentityModule,
    HealthModule,
    // Roadmap (Hồ sơ TKKT §3): Organization(M02), MasterData(M03), Barracks(M04),
    // Facilities(M05), Inventory(M06), Inspection(M07), Documents(M08),
    // Maintenance(M09), Scenario(M10), GIS(M11), Reporting(M12), Alert(M13),
    // Integration(M14), Administration(M15). Xem docs/ROADMAP.md.
  ],
  providers: [
    // Xác thực mặc định toàn hệ thống, endpoint công khai đánh dấu @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
