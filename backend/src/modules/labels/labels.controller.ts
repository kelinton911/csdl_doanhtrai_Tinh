import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { LabelsService } from './labels.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M10 — Tem QR & tra cứu khi quét (kiểm kê, tra cứu hiện trường).
@ApiTags('Labels & Scan (M10)')
@ApiBearerAuth()
@Controller()
export class LabelsController {
  constructor(private readonly service: LabelsService) {}

  // Tra cứu khi quét — mọi người dùng đã xác thực; trả route để webapp điều hướng.
  @Get('scan/:type/:code')
  @ApiOperation({ summary: 'M10: Tra cứu đối tượng từ mã quét (barracks|storage|asset)' })
  resolve(@Param('type') type: string, @Param('code') code: string) {
    return this.service.resolve(type, decodeURIComponent(code));
  }

  @Get('labels/:type/:code/qr.png')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiProduces('image/png')
  @ApiOperation({ summary: 'M10: Ảnh QR (PNG) cho một mã' })
  async qr(
    @Param('type') type: string,
    @Param('code') code: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ) {
    const png = await this.service.qrPng(
      type,
      decodeURIComponent(code),
      size ? parseInt(size, 10) : 320,
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(png);
  }

  @Get('labels/:type/sheet.pdf')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'M10: Tờ tem QR (PDF) cho nhiều mã (?codes=a,b,c)' })
  async sheet(
    @Param('type') type: string,
    @Query('codes') codes: string | undefined,
    @Res() res: Response,
  ) {
    const pdf = await this.service.labelSheet(type, (codes ?? '').split(','));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="qr-labels-${type}.pdf"`);
    res.send(pdf);
  }
}
