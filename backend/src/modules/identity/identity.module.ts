import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';

// M01 — Identity & Access: tài khoản, vai trò, phạm vi dữ liệu, phiên, chính sách truy cập.
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
    // global: guard xác thực toàn cục (APP_GUARD) trong AppModule cần JwtService.
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService],
  exports: [AuthService, UsersService],
})
export class IdentityModule {}
