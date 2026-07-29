import * as fs from 'fs';
import { join } from 'path';
import {
  allocateChildCode,
  ancestorsOf,
  deriveTree,
  domainOf,
  levelOf,
  parentOf,
  romanPrefix,
  toSearchText,
  RawAssetRow,
} from './asset-code.util';

// Nạp chính bộ dữ liệu đã cam kết — test chạy trên phụ lục thật, không phải fixture bịa.
const DATA_FILE = join(
  __dirname,
  '..',
  '..',
  'database',
  'seeds',
  'data',
  'asset-catalog-2026.json',
);

describe('asset-code.util — hàm thuần', () => {
  describe('levelOf', () => {
    it('nút gốc là cấp 0', () => {
      expect(levelOf('R00.00.00.00.00.000')).toBe(0);
    });

    it('cấp = vị trí đoạn khác 0 cuối cùng', () => {
      expect(levelOf('R00.00.01.00.00.000')).toBe(3);
      expect(levelOf('R00.00.01.01.02.001')).toBe(6);
      expect(levelOf('R06.04.01.00.00.000')).toBe(3);
      expect(levelOf('R16.00.00.00.00.000')).toBe(1);
    });
  });

  describe('parentOf', () => {
    it('zero hoá đoạn khác 0 cuối cùng', () => {
      expect(parentOf('R00.00.01.01.02.001')).toBe('R00.00.01.01.02.000');
      expect(parentOf('R00.00.01.01.02.000')).toBe('R00.00.01.01.00.000');
    });

    it('các gốc chương R06/R13/R14/R15/R16 quy về nút gốc chung', () => {
      for (const code of [
        'R06.00.00.00.00.000',
        'R13.00.00.00.00.000',
        'R14.00.00.00.00.000',
        'R15.00.00.00.00.000',
        'R16.00.00.00.00.000',
      ]) {
        expect(parentOf(code)).toBe('R00.00.00.00.00.000');
      }
    });

    it('nút gốc không có cha', () => {
      expect(parentOf('R00.00.00.00.00.000')).toBeNull();
    });
  });

  it('ancestorsOf trả chuỗi tổ tiên từ gốc xuống', () => {
    expect(ancestorsOf('R00.00.01.01.02.001')).toEqual([
      'R00.00.00.00.00.000',
      'R00.00.01.00.00.000',
      'R00.00.01.01.00.000',
      'R00.00.01.01.02.000',
    ]);
  });

  describe('toSearchText — bỏ dấu để tìm "bom" ra "bơm"', () => {
    it('bỏ dấu và hạ chữ thường', () => {
      expect(toSearchText('Máy bơm nước chạy động cơ điện')).toBe(
        'may bom nuoc chay dong co dien',
      );
    });

    it('xử lý được chữ Đ hoa', () => {
      expect(toSearchText('Đường ống cấp nước')).toBe('duong ong cap nuoc');
    });
  });

  describe('romanPrefix', () => {
    it('nhận số La Mã đầu tên chương, cả khi không có dấu cách', () => {
      expect(romanPrefix('I/ Đất Quốc phòng')).toBe('I');
      expect(romanPrefix('VIII/Thiết bị phòng cháy, chữa cháy')).toBe('VIII');
      expect(romanPrefix('XVIII/ Thang máy')).toBe('XVIII');
    });

    it('không nhầm số thứ tự Ả Rập của nhóm con', () => {
      expect(romanPrefix('1/ Đất làm nơi đóng quân, trụ sở làm việc')).toBeNull();
      expect(romanPrefix('2.4/ Tủ khác')).toBeNull();
    });
  });

  it('domainOf phân miền theo chương', () => {
    expect(domainOf('I', false)).toBe('FACILITY');
    expect(domainOf('XVII', false)).toBe('FACILITY');
    expect(domainOf('V', false)).toBe('MATERIAL');
    expect(domainOf('XVIII', false)).toBe('MATERIAL');
    expect(domainOf(null, true)).toBe('ROOT');
    expect(domainOf(null, false)).toBe('UNCLASSIFIED');
  });
});

describe('deriveTree trên phụ lục thật (1272 mã)', () => {
  const rows: RawAssetRow[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).items;
  const nodes = deriveTree(rows);
  const byCode = new Map(nodes.map((n) => [n.code, n]));

  it('giữ nguyên số lượng nút', () => {
    expect(nodes).toHaveLength(1272);
  });

  it('không có nút mồ côi', () => {
    const codes = new Set(nodes.map((n) => n.code));
    const orphans = nodes.filter((n) => n.parentCode && !codes.has(n.parentCode));
    expect(orphans).toEqual([]);
  });

  it('phân bố cấp đúng như phụ lục', () => {
    const hist: Record<number, number> = {};
    nodes.forEach((n) => {
      hist[n.level] = (hist[n.level] ?? 0) + 1;
    });
    expect(hist).toEqual({ 0: 1, 1: 5, 2: 14, 3: 28, 4: 71, 5: 116, 6: 1037 });
  });

  it('1081 nút lá / 191 nút nhóm', () => {
    expect(nodes.filter((n) => n.isLeaf)).toHaveLength(1081);
    expect(nodes.filter((n) => !n.isLeaf)).toHaveLength(191);
  });

  // R2 — chốt số nút có nguy cơ cộng trùng, để bản phụ lục mới không âm thầm đổi.
  it('đánh dấu đúng 17 nút vừa có ĐVT vừa có con', () => {
    const dual = nodes.filter((n) => n.unitOnGroup);
    expect(dual).toHaveLength(17);
    expect(dual.map((n) => n.code)).toContain('R00.00.07.07.00.000');
    expect(dual.map((n) => n.code)).toContain('R06.03.00.00.00.000');
  });

  // R6 — chương nằm ở HAI độ sâu mã khác nhau; đây là lỗi dễ mắc nhất.
  describe('nhận diện chương (duyệt ngược tổ tiên, KHÔNG dựa vào level)', () => {
    it('có đúng 17 chương và KHÔNG có chương VI', () => {
      const chapters = [...new Set(nodes.map((n) => n.chapter).filter(Boolean))];
      expect(chapters).toHaveLength(17);
      expect(chapters).not.toContain('VI');
    });

    it('chương I–XIII nằm ở đoạn mã thứ 3 (cấp 3)', () => {
      expect(byCode.get('R00.00.01.00.00.000')!.chapter).toBe('I');
      expect(byCode.get('R00.00.13.00.00.000')!.chapter).toBe('XIII');
      expect(levelOf('R00.00.01.00.00.000')).toBe(3);
    });

    it('chương XIV–XVIII nằm ở đoạn mã đầu (cấp 1) — không cùng độ sâu với I–XIII', () => {
      expect(byCode.get('R06.00.00.00.00.000')!.chapter).toBe('XIV');
      expect(byCode.get('R13.00.00.00.00.000')!.chapter).toBe('XV');
      expect(byCode.get('R16.00.00.00.00.000')!.chapter).toBe('XVIII');
      expect(levelOf('R06.00.00.00.00.000')).toBe(1);
    });

    it('nút con kế thừa chương của tổ tiên', () => {
      expect(byCode.get('R00.00.01.01.02.001')!.chapter).toBe('I');
      expect(byCode.get('R13.01.00.00.00.042')!.chapter).toBe('XV');
    });
  });

  it('phân miền: 385 công trình · 884 vật chất · 1 gốc · 2 chưa phân loại', () => {
    const dom: Record<string, number> = {};
    nodes.forEach((n) => {
      dom[n.domain] = (dom[n.domain] ?? 0) + 1;
    });
    expect(dom).toEqual({ ROOT: 1, FACILITY: 385, MATERIAL: 884, UNCLASSIFIED: 2 });
  });

  // 121 dòng tên đúng bằng "Các loại khác" — vô nghĩa nếu thiếu đường dẫn tổ tiên.
  it('mọi nút đều có pathNames đầy đủ từ gốc', () => {
    const orphanNames = nodes.filter((n) => !n.pathNames.startsWith('Doanh trại'));
    expect(orphanNames).toEqual([]);
    expect(byCode.get('R00.00.01.01.02.999')!.pathNames).toBe(
      'Doanh trại › I/ Đất Quốc phòng › 1/ Đất làm nơi đóng quân, trụ sở làm việc › ' +
        'Đất làm nơi đóng quân, trụ sở làm việc sử dụng làm Khu gia đình › Các loại khác',
    );
  });

  // R3 — cảnh báo trùng tên giữa các chương, nhưng KHÔNG gắn cờ các tên bao chung.
  describe('cảnh báo trùng tên khác chương', () => {
    it('bắt được trùng lặp giữa chương XIV và XV', () => {
      const a = byCode.get('R06.04.01.00.00.045')!; // Vòng bi máy bơm nước (XIV)
      const b = byCode.get('R13.01.00.00.00.002')!; // Vòng bi máy bơm nước (XV)
      expect(a.duplicateGroup).toBeTruthy();
      expect(a.duplicateGroup).toBe(b.duplicateGroup);
    });

    it('KHÔNG gắn cờ các dòng "Các loại khác" — chúng lặp theo thiết kế', () => {
      const flagged = nodes.filter(
        (n) => n.duplicateGroup && n.name.trim() === 'Các loại khác',
      );
      expect(flagged).toEqual([]);
    });
  });
});

describe('allocateChildCode — cấp mã đề xuất bổ sung', () => {
  const rows: RawAssetRow[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).items;
  const nodes = deriveTree(rows);
  const childrenOf = (parent: string) =>
    nodes.filter((n) => n.parentCode === parent).map((n) => n.code);

  // Bẫy chính: phụ lục có chỗ NHẢY CẤP. Cha 'R00.00.07.07.00.000' ở cấp 4 nhưng các
  // con lại biến thiên ở đoạn 5 (cấp 6). Suy theo cấp cha sẽ ra mã sai độ sâu.
  it('suy đoạn biến thiên từ các con hiện có, không từ cấp của cha', () => {
    const parent = 'R00.00.07.07.00.000'; // "7/ Vật tư điện" — 89 con ở đoạn 5
    const result = allocateChildCode(parent, childrenOf(parent));
    expect(result.segmentIndex).toBe(5);
    expect(result.inferredFrom).toBe('siblings');
    expect(result.code).toBe('R00.00.07.07.00.099');
  });

  it('bỏ qua mã canh gác .999 khi tính mã kế tiếp', () => {
    const parent = 'R00.00.01.01.02.000';
    const result = allocateChildCode(parent, [
      'R00.00.01.01.02.001',
      'R00.00.01.01.02.002',
      'R00.00.01.01.02.999', // "Các loại khác" — không được coi là mã lớn nhất
    ]);
    expect(result.code).toBe('R00.00.01.01.02.003');
  });

  it('nhánh chưa có con thì đặt ở đoạn ngay sau cấp cha và báo là suy đoán', () => {
    const result = allocateChildCode('R00.00.05.08.00.000', []);
    expect(result.inferredFrom).toBe('parent-level');
    expect(result.code).toBe('R00.00.05.08.01.000');
  });

  it('từ chối khi nhánh đã hết mã', () => {
    const siblings = Array.from({ length: 98 }, (_, i) =>
      `R00.00.01.01.${String(i + 1).padStart(2, '0')}.000`,
    );
    expect(() => allocateChildCode('R00.00.01.01.00.000', siblings)).toThrow(
      /hết mã/,
    );
  });

  it('từ chối khi cha đã ở cấp cuối', () => {
    expect(() => allocateChildCode('R00.00.01.01.02.001', [])).toThrow(/cấp cuối/);
  });
});
