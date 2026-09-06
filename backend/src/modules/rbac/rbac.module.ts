import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './entities/position.entity';
import { AppFunction } from './entities/app-function.entity';
import { PositionFunction } from './entities/position-function.entity';
import { UserPosition } from './entities/user-position.entity';
import { UserPermissionGrant } from './entities/user-permission-grant.entity';
import { PermissionConflict } from './entities/permission-conflict.entity';
import { AuthorizationService } from './authorization.service';
import { PositionsService } from './positions.service';
import { FunctionsService } from './functions.service';
import { UserPositionsService } from './user-positions.service';
import { GrantsService } from './grants.service';
import { ConflictsService } from './conflicts.service';
import { PositionsController } from './positions.controller';
import { FunctionsController } from './functions.controller';
import { UserPositionsController } from './user-positions.controller';
import { GrantsController } from './grants.controller';
import { ConflictsController } from './conflicts.controller';
import { PermissionsController } from './permissions.controller';

// M01-RBAC — RBAC theo Chức vụ–Chức năng: chức vụ, chức năng, ma trận phân quyền,
// bổ nhiệm, cấp quyền lẻ, SoD, và engine authorize (export cho PermissionGuard toàn cục).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Position,
      AppFunction,
      PositionFunction,
      UserPosition,
      UserPermissionGrant,
      PermissionConflict,
    ]),
  ],
  controllers: [
    PositionsController,
    FunctionsController,
    UserPositionsController,
    GrantsController,
    ConflictsController,
    PermissionsController,
  ],
  providers: [
    AuthorizationService,
    PositionsService,
    FunctionsService,
    UserPositionsService,
    GrantsService,
    ConflictsService,
  ],
  exports: [AuthorizationService],
})
export class RbacModule {}
