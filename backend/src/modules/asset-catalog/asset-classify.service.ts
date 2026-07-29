import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCatalogItem } from './entities/asset-catalog-item.entity';
import { Material } from '../master-data/entities/material.entity';
import { MaterialVersion } from '../master-data/entities/material-version.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface SetAssetCodeInput {
  assetCode?: string | null;
  status?: 'MAPPED' | 'OUT_OF_SCOPE' | 'UNMAPPED' | 'PROPOSED';
}

/**
 * Gắn mã quốc gia (TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI) cho vật chất / công trình.
 *
 * TÁCH RIÊNG khỏi MasterDataService một cách CÓ CHỦ Ý:
 * `MasterDataService.updateMaterial` ném WF-001 với mọi vật chất đã PUBLISHED. Nhưng gắn
 * mã phân loại KHÔNG phải sửa hồi tố nội dung — nếu đi qua đường đó thì sẽ không bao giờ
 * phân loại được cho dữ liệu thật (toàn bộ 788 mã chính thức đều ở trạng thái PUBLISHED).
 * Ở đây chỉ đụng đúng 2 cột asset_code / asset_code_status, và vẫn ghi snapshot
 * changeType='CLASSIFY' để không hổng vết kiểm toán.
 */
@Injectable()
export class AssetClassifyService {
  constructor(
    @InjectRepository(AssetCatalogItem)
    private readonly items: Repository<AssetCatalogItem>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(MaterialVersion)
    private readonly versions: Repository<MaterialVersion>,
    @InjectRepository(Facility) private readonly facilities: Repository<Facility>,
  ) {}

  /** Mã phải tồn tại, còn hiệu lực, và thuộc đúng miền nghiệp vụ. */
  private async requireCode(code: string, domain: 'MATERIAL' | 'FACILITY') {
    const item = await this.items.findOne({ where: { code } });
    if (!item) {
      throw new BadRequestException(`DATA-001: Mã tài sản ${code} không có trong danh mục`);
    }
    if (item.status !== 'ACTIVE') {
      throw new BadRequestException(
        `DATA-002: Mã ${code} đã ngừng hiệu lực (${item.status}) ở bản phụ lục hiện hành`,
      );
    }
    if (item.domain !== domain) {
      const expected = domain === 'MATERIAL' ? 'vật chất' : 'công trình';
      throw new BadRequestException(
        `DATA-004: Mã ${code} thuộc miền ${item.domain}, không dùng cho ${expected}. ` +
          `(${item.pathNames})`,
      );
    }
    return item;
  }

  private resolveStatus(input: SetAssetCodeInput): string {
    if (input.status) return input.status;
    return input.assetCode ? 'MAPPED' : 'UNMAPPED';
  }

  async setMaterialAssetCode(id: string, input: SetAssetCodeInput, user: AuthUser) {
    const material = await this.materials.findOne({ where: { id } });
    if (!material) throw new NotFoundException('DATA-001: Không tìm thấy vật chất');

    if (input.assetCode) await this.requireCode(input.assetCode, 'MATERIAL');

    material.assetCode = input.assetCode ?? null;
    material.assetCodeStatus = this.resolveStatus(input);
    material.updatedBy = user.sub;
    const saved = await this.materials.save(material);

    // Vết kiểm toán: phân loại vẫn được ghi lịch sử như mọi thay đổi khác.
    const count = await this.versions.count({ where: { materialId: saved.id } });
    await this.versions.save(
      this.versions.create({
        materialId: saved.id,
        version: count + 1,
        changeType: 'CLASSIFY',
        snapshot: {
          code: saved.code,
          name: saved.name,
          assetCode: saved.assetCode,
          assetCodeStatus: saved.assetCodeStatus,
          status: saved.status,
        },
        createdBy: user.sub,
      }),
    );

    return saved;
  }

  async setFacilityAssetCode(id: string, input: SetAssetCodeInput, user: AuthUser) {
    const facility = await this.facilities.findOne({ where: { id } });
    if (!facility) throw new NotFoundException('DATA-001: Không tìm thấy công trình');

    if (input.assetCode) await this.requireCode(input.assetCode, 'FACILITY');

    facility.assetCode = input.assetCode ?? null;
    facility.assetCodeStatus = this.resolveStatus(input);
    facility.updatedBy = user.sub;
    return this.facilities.save(facility);
  }
}
