import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigitalSignatureEntity } from './entities/digital-signature.entity';
import { DigitalSignatureService } from './digital-signature.service';
import { DigitalSignatureController } from './digital-signature.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DigitalSignatureEntity])],
  controllers: [DigitalSignatureController],
  providers: [DigitalSignatureService],
  exports: [DigitalSignatureService],
})
export class DigitalSignatureModule {}
