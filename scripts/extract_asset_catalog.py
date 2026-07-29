#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Trich xuat "TONG DANH MUC TAI SAN NGANH DOANH TRAI" tu PDF sang JSON.

Nguon: docs/Phu luc kem theo Vb.pdf — Phu luc kem Cong van so 2837/DT-QLDT
ngay 16/7/2026 cua Cuc Doanh trai/TCHC-KT.

NGUYEN TAC: KHONG bia du lieu. Script chi doc 4 cot co that trong van ban
(STT, Ma vat tu, Ten vat tu, DVT) va chuan hoa DUY NHAT khoang trang.
Moi truong dan xuat (level, parent_code, path, chapter, domain, is_leaf,
unit_code) duoc tinh trong seeder TypeScript, KHONG nam trong file nay —
de file cam ket luon la ban sao trung thuc cua van ban goc.

Dau ra:
  backend/src/database/seeds/data/asset-catalog-2026.json
  backend/src/database/seeds/data/asset-catalog-2026.json.sha256

Chay:
  python scripts/extract_asset_catalog.py
  python scripts/extract_asset_catalog.py --pdf <duong/dan.pdf> --out <duong/dan.json>

Yeu cau: PyMuPDF (fitz). Da kiem chung tren PyMuPDF 1.27.x / Python 3.14.
Neu doi phien ban PyMuPDF, PHAI chay lai va soat ky diff cua file JSON.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("Thieu PyMuPDF. Cai bang: pip install pymupdf")

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = REPO_ROOT / "docs" / "Phu luc kem theo Vb.pdf"
DEFAULT_OUT = (
    REPO_ROOT / "backend" / "src" / "database" / "seeds" / "data" / "asset-catalog-2026.json"
)

# Ma vat tu: R## . ## . ## . ## . ## . ###  (6 doan, doan dau co tien to R).
CODE_RE = re.compile(r"^R\d{2}(?:\.\d{2}){4}\.\d{3}$")

# Cac hang so kiem chung — rut ra tu chinh van ban goc, dung lam chot toan ven.
EXPECTED_ITEMS = 1272
EXPECTED_MAX_STT = 1271

SOURCE_DOC = "Phu luc kem theo Vb.pdf"
REVISION = "2837/DT-QLDT-2026"
VAN_BAN = "Cong van so 2837/DT-QLDT"
NGAY_VAN_BAN = "2026-07-16"


def norm_space(value: object) -> str:
    """Chuan hoa DUY NHAT khoang trang. Khong bien doi gi khac."""
    return re.sub(r"\s+", " ", str(value or "").replace("\n", " ")).strip()


def extract(pdf_path: Path) -> tuple[list[dict], str]:
    """Doc moi bang trong PDF, giu lai cac dong co ma vat tu hop le."""
    doc = fitz.open(pdf_path)
    items: list[dict] = []
    for page in doc:
        for table in page.find_tables():
            for row in table.extract():
                if not row or len(row) < 4:
                    continue
                code = norm_space(row[1])
                # Dieu kien nay tu loai bo 2 dong tieu de, khong can hueristic.
                if not CODE_RE.match(code):
                    continue
                stt_raw = norm_space(row[0])
                items.append(
                    {
                        "stt": int(stt_raw) if stt_raw.isdigit() else None,
                        "code": code,
                        "name": norm_space(row[2]),
                        "unitRaw": norm_space(row[3]) or None,
                    }
                )
    version = norm_space((getattr(fitz, "__doc__", "") or "").split("\n")[0])
    doc.close()
    return items, version


def assert_integrity(items: list[dict]) -> None:
    """Chan moi sai lech TRUOC khi ghi file. Loi la loi cung, khong canh bao."""
    errors: list[str] = []

    if len(items) != EXPECTED_ITEMS:
        errors.append(f"So dong = {len(items)}, mong doi {EXPECTED_ITEMS}")

    codes = [i["code"] for i in items]
    if len(set(codes)) != len(codes):
        seen: set[str] = set()
        dups = sorted({c for c in codes if c in seen or seen.add(c)})  # type: ignore[func-returns-value]
        errors.append(f"Ma trung ({len(dups)}): {dups[:10]}")

    # Thu tu tai lieu phai trung thu tu sap xep theo ma — nho vay
    # `ORDER BY code` tai lap dung phu luc, khong can cot sort_key.
    if codes != sorted(codes):
        first = next(
            (i for i, (a, b) in enumerate(zip(codes, sorted(codes))) if a != b), None
        )
        errors.append(f"Thu tu tai lieu != thu tu ma, lech dau tien o chi so {first}")

    stts = [i["stt"] for i in items if i["stt"] is not None]
    blanks = sum(1 for i in items if i["stt"] is None)
    if blanks != 1:
        errors.append(f"So dong khong co STT = {blanks}, mong doi 1 (dong goc)")
    if stts != list(range(1, EXPECTED_MAX_STT + 1)):
        errors.append(f"STT khong lien tuc 1..{EXPECTED_MAX_STT} (co {len(stts)} gia tri)")

    missing_name = [i["code"] for i in items if not i["name"]]
    if missing_name:
        errors.append(f"Dong thieu ten ({len(missing_name)}): {missing_name[:10]}")

    if errors:
        print("KIEM TRA TOAN VEN THAT BAI:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    if not args.pdf.exists():
        sys.exit(f"Khong thay PDF: {args.pdf}")

    items, pymupdf_version = extract(args.pdf)
    assert_integrity(items)

    payload = {
        "meta": {
            "sourceDoc": SOURCE_DOC,
            "revision": REVISION,
            "vanBan": VAN_BAN,
            "ngayVanBan": NGAY_VAN_BAN,
            "coQuanBanHanh": "Cuc Doanh trai/TCHC-KT",
            # Khong ghi thoi diem trich xuat: dau ra phai TAT DINH de chay lai
            # cho `git diff` rong. Thoi diem trich xuat da nam trong lich su git.
            "pymupdfVersion": pymupdf_version.strip(),
            "itemCount": len(items),
            "note": (
                "Chi gom 4 cot co that trong van ban goc. "
                "Moi truong dan xuat duoc tinh trong seed-asset-catalog.ts."
            ),
        },
        "items": items,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    # newline="\n" bat buoc: tren Windows write_text() se doi thanh CRLF, lam
    # file phu thuoc nen tang va lam sai sha256 sau khi git chuan hoa xuong LF.
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)

    digest = hashlib.sha256(args.out.read_bytes()).hexdigest()
    sidecar = args.out.with_suffix(args.out.suffix + ".sha256")
    with open(sidecar, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"{digest}  {args.out.name}\n")

    leaves = _leaf_count(items)
    print(f"  OK  {len(items)} dong -> {args.out.relative_to(REPO_ROOT)}")
    print(f"      nut la {leaves} · nut nhom {len(items) - leaves}")
    print(f"      sha256 {digest}")
    print(f"      sidecar {sidecar.name}")


def _leaf_count(items: list[dict]) -> int:
    """Dem nut la — chi de in tong ket; seeder moi la noi dan xuat chinh thuc."""
    codes = {i["code"] for i in items}
    parents = set()
    for code in codes:
        segs = [code[1:3]] + code.split(".")[1:]
        level = 0
        for idx, seg in enumerate(segs):
            if int(seg) != 0:
                level = idx + 1
        if level == 0:
            continue
        s = list(segs)
        s[level - 1] = "000" if level == 6 else "00"
        parent = "R" + s[0] + "." + ".".join(s[1:])
        if parent != code:
            parents.add(parent)
    return len(codes - parents)


if __name__ == "__main__":
    main()
