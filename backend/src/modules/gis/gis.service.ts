import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface Feature {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

// M11 — GIS (UC-17). Trả GeoJSON; luôn áp quyền/scope trước khi xử lý (lộ trình data-scope).
@Injectable()
export class GisService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private toCollection(features: Feature[]): FeatureCollection {
    return { type: 'FeatureCollection', features };
  }

  private layerSql(layer: string): { sql: string; label: string } {
    if (layer === 'facilities') {
      return {
        label: 'facilities',
        sql: `SELECT f.id, f.code, f.name, f.status, f.condition, f.type, f.barracks_id,
                     ST_AsGeoJSON(f.location) AS geo
              FROM facilities f WHERE f.location IS NOT NULL`,
      };
    }
    // mặc định: doanh trại
    return {
      label: 'barracks',
      sql: `SELECT b.id, b.code, b.name, b.workflow_status AS status, b.declared_capacity,
                   ST_AsGeoJSON(b.location) AS geo
            FROM barracks b WHERE b.location IS NOT NULL`,
    };
  }

  // GET /gis/features?layer=&bbox=minLng,minLat,maxLng,maxLat
  async features(layer: string, bbox?: string) {
    const { sql, label } = this.layerSql(layer);
    let query = sql;
    const params: unknown[] = [];
    if (bbox) {
      const p = bbox.split(',').map(Number);
      if (p.length !== 4 || p.some((n) => Number.isNaN(n))) {
        throw new BadRequestException('VAL-001: bbox phải là minLng,minLat,maxLng,maxLat');
      }
      query += ` AND ${label === 'facilities' ? 'f' : 'b'}.location && ST_MakeEnvelope($1,$2,$3,$4,4326)`;
      params.push(...p);
    }
    const rows = await this.ds.query(query, params);
    return this.toCollection(rows.map((r: Record<string, unknown>) => this.rowToFeature(r)));
  }

  // POST /gis/search-within {lng, lat, radiusMeters, layer}
  async searchWithin(body: {
    layer?: string;
    lng: number;
    lat: number;
    radiusMeters: number;
  }) {
    if (
      typeof body.lng !== 'number' ||
      typeof body.lat !== 'number' ||
      typeof body.radiusMeters !== 'number'
    ) {
      throw new BadRequestException('VAL-001: cần lng, lat, radiusMeters');
    }
    const { sql, label } = this.layerSql(body.layer ?? 'barracks');
    const alias = label === 'facilities' ? 'f' : 'b';
    const query = `${sql} AND ST_DWithin(${alias}.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)`;
    const rows = await this.ds.query(query, [body.lng, body.lat, body.radiusMeters]);
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
