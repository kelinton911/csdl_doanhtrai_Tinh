import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface Feature {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

// Cấu hình một lớp bản đồ (điểm hoặc vùng) + cách áp phạm vi dữ liệu.
interface LayerCfg {
  label: string;
  from: string; // mệnh đề FROM (kèm alias + join nếu cần)
  geom: string; // biểu thức cột hình học, vd 'b.location' | 'a.geometry'
  isPolygon: boolean;
  columns: string; // các cột thuộc tính (không gồm hình học)
  baseWhere?: string; // lọc cơ sở (vd cấp hành chính)
  scopeAreaCol?: string; // cột địa bàn để áp scope (uuid)
  scopeOrgCol?: string; // cột đơn vị để áp scope (uuid)
  provinceCol?: string; // cột mã tỉnh để lọc theo tỉnh
  limit: number;
}

// M11 — GIS (UC-17). Trả GeoJSON đa lớp; LUÔN áp quyền/scope trước khi trả (ROADMAP §5).
@Injectable()
export class GisService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private toCollection(features: Feature[]): FeatureCollection {
    return { type: 'FeatureCollection', features };
  }

  private layers(): Record<string, LayerCfg> {
    return {
      barracks: {
        label: 'barracks',
        from: 'barracks b',
        geom: 'b.location',
        isPolygon: false,
        columns:
          'b.id, b.code, b.name, b.workflow_status AS status, b.declared_capacity, b.function, b.area_id',
        scopeAreaCol: 'b.area_id',
        scopeOrgCol: 'b.organization_id',
        limit: 5000,
      },
      facilities: {
        label: 'facilities',
        from: 'facilities f JOIN barracks b ON b.id = f.barracks_id',
        geom: 'f.location',
        isPolygon: false,
        columns: 'f.id, f.code, f.name, f.status, f.condition, f.type, f.barracks_id',
        scopeAreaCol: 'b.area_id',
        scopeOrgCol: 'b.organization_id',
        limit: 5000,
      },
      'storage-locations': {
        label: 'storage-locations',
        from: 'storage_locations s LEFT JOIN barracks b ON b.id = s.barracks_id',
        geom: 's.location',
        isPolygon: false,
        columns: "s.id, s.code, s.name, s.type, s.status, 'KHO' AS category",
        scopeAreaCol: 'b.area_id',
        scopeOrgCol: 'b.organization_id',
        limit: 5000,
      },
      pois: {
        label: 'pois',
        from: 'map_pois p',
        geom: 'p.location',
        isPolygon: false,
        columns:
          'p.id, p.code, p.name, p.category, p.symbol_code, p.status, p.area_id, p.province_code',
        scopeAreaCol: 'p.area_id',
        provinceCol: 'p.province_code',
        limit: 5000,
      },
      areas: {
        label: 'areas',
        from: 'administrative_areas a',
        geom: 'a.geometry',
        isPolygon: true,
        columns: 'a.id, a.code, a.name, a.type, a.level, a.province_code',
        baseWhere: "a.level = 'COMMUNE'",
        provinceCol: 'a.province_code',
        limit: 5000,
      },
      provinces: {
        label: 'provinces',
        from: 'administrative_areas a',
        geom: 'a.geometry',
        isPolygon: true,
        columns: 'a.id, a.code, a.name, a.type, a.level, a.province_code',
        baseWhere: "a.level = 'PROVINCE'",
        provinceCol: 'a.province_code',
        limit: 100,
      },
    };
  }

  // Dung sai đơn giản hoá ranh giới (độ). Tỉnh nới rộng hơn xã để nhẹ ở mức thu nhỏ.
  private tolerance(simplify: string | undefined, layer: string): number {
    const s = Number(simplify);
    if (!Number.isNaN(s) && s >= 0 && s <= 1) return s;
    return layer === 'provinces' ? 0.01 : 0.001;
  }

  // Bổ sung điều kiện phạm vi dữ liệu; trả về mảng mệnh đề WHERE cho scope.
  private scopeWhere(
    cfg: LayerCfg,
    user: AuthUser | undefined,
    push: (v: unknown) => string,
  ): string[] {
    const scope = barracksScope(user); // null = xem toàn tỉnh
    if (!scope) return [];
    const clauses: string[] = [];
    if (cfg.scopeAreaCol && scope.areaIds.length) {
      clauses.push(`${cfg.scopeAreaCol} = ANY(${push(scope.areaIds)}::uuid[])`);
    }
    if (cfg.scopeOrgCol && scope.organizationId) {
      clauses.push(`${cfg.scopeOrgCol} = ${push(scope.organizationId)}::uuid`);
    }
    if (clauses.length) return [`(${clauses.join(' OR ')})`];
    // Người dùng bị giới hạn nhưng lớp có thể áp scope mà không khớp gì → không trả điểm.
    if (cfg.scopeAreaCol || cfg.scopeOrgCol) return ['false'];
    return [];
  }

  // GET /gis/features?layer=&bbox=minLng,minLat,maxLng,maxLat&simplify=&province=
  async features(
    layer: string,
    opts: { bbox?: string; simplify?: string; province?: string; user?: AuthUser } = {},
  ) {
    const cfg = this.layers()[layer] ?? this.layers().barracks;
    const params: unknown[] = [];
    const push = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    const geoExpr = cfg.isPolygon
      ? `ST_AsGeoJSON(ST_Simplify(${cfg.geom}, ${push(this.tolerance(opts.simplify, layer))}))`
      : `ST_AsGeoJSON(${cfg.geom})`;

    const where: string[] = [`${cfg.geom} IS NOT NULL`];
    if (cfg.baseWhere) where.push(cfg.baseWhere);

    if (opts.bbox) {
      const b = opts.bbox.split(',').map(Number);
      if (b.length !== 4 || b.some((n) => Number.isNaN(n))) {
        throw new BadRequestException('VAL-001: bbox phải là minLng,minLat,maxLng,maxLat');
      }
      where.push(
        `${cfg.geom} && ST_MakeEnvelope(${push(b[0])},${push(b[1])},${push(b[2])},${push(b[3])},4326)`,
      );
    }
    if (opts.province && cfg.provinceCol) {
      where.push(`${cfg.provinceCol} = ${push(opts.province)}`);
    }
    where.push(...this.scopeWhere(cfg, opts.user, push));

    const sql = `SELECT ${cfg.columns}, ${geoExpr} AS geo FROM ${cfg.from} WHERE ${where.join(' AND ')} LIMIT ${cfg.limit}`;
    const rows = await this.ds.query(sql, params);
    return this.toCollection(rows.map((r: Record<string, unknown>) => this.rowToFeature(r)));
  }

  // POST /gis/search-within {lng, lat, radiusMeters, layer} — chỉ lớp điểm.
  async searchWithin(body: {
    layer?: string;
    lng: number;
    lat: number;
    radiusMeters: number;
    user?: AuthUser;
  }) {
    if (
      typeof body.lng !== 'number' ||
      typeof body.lat !== 'number' ||
      typeof body.radiusMeters !== 'number'
    ) {
      throw new BadRequestException('VAL-001: cần lng, lat, radiusMeters');
    }
    const cfg = this.layers()[body.layer ?? 'barracks'] ?? this.layers().barracks;
    if (cfg.isPolygon) {
      throw new BadRequestException('VAL-001: truy vấn lân cận chỉ áp dụng cho lớp điểm');
    }
    const params: unknown[] = [];
    const push = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where: string[] = [`${cfg.geom} IS NOT NULL`];
    if (cfg.baseWhere) where.push(cfg.baseWhere);
    where.push(
      `ST_DWithin(${cfg.geom}::geography, ST_SetSRID(ST_MakePoint(${push(body.lng)},${push(body.lat)}),4326)::geography, ${push(body.radiusMeters)})`,
    );
    where.push(...this.scopeWhere(cfg, body.user, push));

    const sql = `SELECT ${cfg.columns}, ST_AsGeoJSON(${cfg.geom}) AS geo FROM ${cfg.from} WHERE ${where.join(' AND ')} LIMIT ${cfg.limit}`;
    const rows = await this.ds.query(sql, params);
    return this.toCollection(rows.map((r: Record<string, unknown>) => this.rowToFeature(r)));
  }

  private rowToFeature(r: Record<string, unknown>): Feature {
    const { geo, ...props } = r;
    return {
      type: 'Feature',
      geometry: geo ? JSON.parse(geo as string) : null,
      properties: props,
    };
  }
}
