import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogisticsCalcNorm } from './entities/logistics-calc-norm.entity';
import { ComputeLogisticsDto } from './dto/logistics-norms.dto';

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface ComputedLine {
  code: string;
  name: string;
  unit: string | null;
  quantity: number;
  count?: number;
  formula: string;
}

// Khâu 4 — Định mức HC-KT + engine tính bảo đảm chiến đấu (căn cứ Quiuoctinhtoan.pdf).
// Bản đầu tự tính QN/QY/DT suy từ quân số + tham số tình huống; XD/VT/QS để tra cứu định mức.
@Injectable()
export class LogisticsNormsService {
  constructor(
    @InjectRepository(LogisticsCalcNorm)
    private readonly repo: Repository<LogisticsCalcNorm>,
  ) {}

  async list(branch?: string) {
    return this.repo.find({
      where: branch ? { branch } : {},
      order: { branch: 'ASC', sortOrder: 'ASC' },
    });
  }

  // Tính nhu cầu bảo đảm theo quy ước; kết quả ở trạng thái "Dự thảo" (nêu căn cứ, không bịa).
  async compute(dto: ComputeLogisticsDto) {
    const troop = dto.troopCount;
    const days = dto.durationDays;
    const combatType = dto.combatType ?? 'TIEN_CONG';
    const defaultRate = combatType === 'PHONG_NGU' ? 9 : 15; // tài liệu: tiến công 10–20%, phòng ngự 8–10%
    const ratePct = dto.casualtyRatePct ?? defaultRate;
    const rate = ratePct / 100;
    const estimatedTB = Math.round(troop * rate * days);

    const norms = await this.repo.find({ order: { branch: 'ASC', sortOrder: 'ASC' } });
    const branches: Record<string, ComputedLine[]> = {};
    for (const n of norms) {
      const v = n.value !== null ? Number(n.value) : 0;
      let line: Omit<ComputedLine, 'code' | 'name' | 'unit'> | null = null;
      switch (n.calcRole) {
        case 'PERSON_DAY':
          line = { quantity: round3(v * troop * days), formula: `${v} × ${troop} người × ${days} ngày` };
          break;
        case 'PERSON_MONTH':
          line = { quantity: round3(v * troop * (days / 30)), formula: `${v} × ${troop} người × ${days}/30 tháng` };
          break;
        case 'PERSON_ONCE':
          line = { quantity: round3(v * troop), formula: `${v} × ${troop} người` };
          break;
        case 'CASUALTY_SUAT':
          line = { quantity: round3(v * estimatedTB), count: estimatedTB, formula: `${v} × ${estimatedTB} TB` };
          break;
        case 'CASUALTY_COSO': {
          const tbPer = Number((n.attributes as { tbPer?: number })?.tbPer) || 1;
          const count = estimatedTB > 0 ? Math.ceil(estimatedTB / tbPer) : 0;
          line = { quantity: round3(v * count), count, formula: `⌈${estimatedTB} TB / ${tbPer}⌉ = ${count} cơ số × ${v}` };
          break;
        }
        default:
          continue; // REFERENCE — không tự tính, xem ở danh mục định mức
      }
      (branches[n.branch] ??= []).push({ code: n.code, name: n.name, unit: n.unit, ...line });
    }

    return {
      params: { troopCount: troop, durationDays: days, combatType, casualtyRatePct: ratePct },
      estimatedTB,
      status: 'DRAFT',
      source: 'Quiuoctinhtoan.pdf',
      note: 'DỰ THẢO — tính theo quy ước tính toán HC-KT. Bản đầu tự tính QN/QY/DT; Xăng dầu/Vận tải/Quân số xem mục "Định mức" để tra cứu (cần đội xe & cơ cấu đơn vị).',
      branches,
      generatedAt: new Date().toISOString(),
    };
  }
}
