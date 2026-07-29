#!/usr/bin/env python3
"""Download the current upstream boundary archive and build combined GeoJSON layers.

Usage:
  python scripts/build_full_commune_boundaries.py

Optional:
  python scripts/build_full_commune_boundaries.py --catalog vietnam_communes_2026_attributes.geojson --output output
"""
from __future__ import annotations
import argparse
import json
import shutil
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_ZIP_URL = "https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/master/json/vn_provinces_wards_geojson_2026-07-12__19_50_51.zip"


def download(url: str, dst: Path) -> None:
    req = Request(url, headers={"User-Agent": "Vietnam-GIS-GeoJSON-Builder/1.0"})
    with urlopen(req, timeout=180) as r, dst.open("wb") as f:
        shutil.copyfileobj(r, f, length=1024 * 1024)


def code_from_feature(feat: dict, path: Path) -> str:
    fid = feat.get("id")
    if fid is not None:
        digits = ''.join(ch for ch in str(fid) if ch.isdigit())
        if len(digits) >= 5:
            return digits[-5:]
    stem = path.stem
    prefix = stem.split('_', 1)[0]
    return prefix.zfill(5)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', type=Path, default=Path(__file__).resolve().parents[1] / 'vietnam_communes_2026_attributes.geojson')
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'full_boundaries')
    ap.add_argument('--archive', type=Path, default=None, help='Use an already downloaded source ZIP')
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    catalog = json.loads(args.catalog.read_text(encoding='utf-8'))
    catalog_by_code = {str(f['properties']['commune_code']).zfill(5): f for f in catalog['features']}

    with tempfile.TemporaryDirectory(prefix='vn_geojson_') as tmp:
        tmp = Path(tmp)
        archive = args.archive or (tmp / 'source.zip')
        if args.archive is None:
            print(f'Downloading {SOURCE_ZIP_URL}')
            download(SOURCE_ZIP_URL, archive)
        extract_dir = tmp / 'extract'
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(extract_dir)

        boundary_by_code = {}
        source_path_by_code = {}
        for path in extract_dir.rglob('*.geojson'):
            if 'wards' not in {part.lower() for part in path.parts}:
                continue
            try:
                obj = json.loads(path.read_text(encoding='utf-8'))
            except Exception:
                continue
            feats = obj.get('features') or []
            if not feats:
                continue
            feat = feats[0]
            code = code_from_feature(feat, path)
            if code in catalog_by_code and feat.get('geometry'):
                boundary_by_code[code] = feat['geometry']
                source_path_by_code[code] = str(path.relative_to(extract_dir))

        combined = []
        grouped = defaultdict(list)
        missing = []
        for code, cat in sorted(catalog_by_code.items()):
            geom = boundary_by_code.get(code)
            if geom is None:
                missing.append(code)
                continue
            props = dict(cat['properties'])
            props['geometry_status'] = 'embedded_polygon'
            props['source_boundary_file'] = source_path_by_code[code]
            feature = {'type':'Feature','id':code,'properties':props,'geometry':geom}
            combined.append(feature)
            grouped[props['province_code']].append(feature)

        output_fc = {
            'type':'FeatureCollection',
            'name':'vietnam_communes_2026_polygons',
            'metadata': {
                'feature_count': len(combined),
                'expected_count': len(catalog_by_code),
                'missing_count': len(missing),
                'crs':'WGS 84 (EPSG:4326)',
                'coordinate_order':'longitude,latitude',
                'source': SOURCE_ZIP_URL,
            },
            'features': combined,
        }
        out_file = args.output / 'vietnam_communes_2026_polygons.geojson'
        out_file.write_text(json.dumps(output_fc, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

        split_dir = args.output / 'communes_by_province'
        split_dir.mkdir(exist_ok=True)
        for pc, feats in sorted(grouped.items()):
            pslug = feats[0]['properties']['province_slug']
            fc = {'type':'FeatureCollection','name':f'{pc}_{pslug}_communes','features':feats}
            (split_dir / f'{pc}_{pslug}_communes.geojson').write_text(
                json.dumps(fc, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

        report = {
            'catalog_count': len(catalog_by_code),
            'polygon_count': len(combined),
            'missing_count': len(missing),
            'missing_codes': missing,
        }
        (args.output / 'build_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
        if missing:
            raise SystemExit('Build incomplete: some boundary files were not matched. See build_report.json')

if __name__ == '__main__':
    main()
