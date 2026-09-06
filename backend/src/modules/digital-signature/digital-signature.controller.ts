import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DigitalSignatureService } from './digital-signature.service';
import { AttachSignatureDto, GenerateDigestDto, VerifySignatureDto } from './dto/digital-signature.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chữ ký số Cơ yếu (Digital Signature PKI)')
@ApiBearerAuth()
@Controller('digital-signature')
export class DigitalSignatureController {
  constructor(private readonly service: DigitalSignatureService) {}

  @Post('generate-digest')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Tạo SHA-256 Digest Hash tài liệu gửi tới USB Token/SIM Cơ yếu' })
  generateDigest(@Body() dto: GenerateDigestDto, @CurrentUser() user: AuthUser) {
    return this.service.generateDigest(dto, user);
  }

  @Post('attach')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Gắn chữ ký số đã ký từ Token Ban Cơ yếu vào hồ sơ' })
  attachSignature(@Body() dto: AttachSignatureDto, @CurrentUser() user: AuthUser) {
    return this.service.attachSignature(dto, user);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Xác thực chữ ký số & chứng thư số PKI' })
  verifySignature(@Body() dto: VerifySignatureDto) {
    return this.service.verifySignature(dto);
  }

  @Get('documents/:documentType/:documentId')
  @ApiOperation({ summary: 'Lịch sử chữ ký số của hồ sơ/tài liệu' })
  getSignaturesByDocument(
    @Param('documentType') documentType: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.getSignaturesByDocument(documentType, documentId);
  }
}
