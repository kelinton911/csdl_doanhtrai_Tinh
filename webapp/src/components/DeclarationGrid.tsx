import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { Icon } from './Icon';
import { CascadingMaterialPicker } from './CascadingMaterialPicker';
import { AddGroupModal } from './AddGroupModal';
import { TemplateModal } from './TemplateModal';
import { RESERVE_PURPOSE_LABEL, type DeclarationLine } from '../lib/materialDeclarations';

// Lưới nhập dòng vật chất kiểu bảng tính (thay modal-từng-dòng):
//  - Thêm nhiều dòng / nhân bản / xóa; sửa trực tiếp trên ô.
//  - Cuối kỳ tự tính = đầu kỳ + tăng − giảm (đến khi người dùng tự sửa).
//  - Dán khối số từ Excel (TSV) vào ô đang chọn → điền lan xuống/ngang.
//  - Cảnh báo đối chiếu theo dòng (không khóa cứng).
//  - Lưu hàng loạt qua POST /material-declarations/:id/lines/bulk.

const PURPOSES = Object.keys(RESERVE_PURPOSE_LABEL);

// Thứ tự cột số (dùng cho render + dán TSV).
const NUM_FIELDS = [
  { key: 'openingQty', label: 'Đầu kỳ', group: 'move' },
  { key: 'increaseQty', label: 'Tăng', group: 'move' },
  { key: 'decreaseQty', label: 'Giảm', group: 'move' },
  { key: 'closingQty', label: 'Cuối kỳ', group: 'move' },
  { key: 'inUseQty', label: 'Đang dùng', group: 'loc' },
  { key: 'ministryStoreQty', label: 'Kho B-Ngành', group: 'loc' },
  { key: 'unitStoreQty', label: 'Kho đơn vị', group: 'loc' },
  { key: 'qtyGrade1', label: 'C1', group: 'q' },
  { key: 'qtyGrade2', label: 'C2', group: 'q' },
  { key: 'qtyGrade3', label: 'C3', group: 'q' },
  { key: 'qtyGrade4', label: 'C4', group: 'q' },
  { key: 'qtyGrade5', label: 'C5', group: 'q' },
  { key: 'unitPrice', label: 'Đơn giá', group: 'val' },
] as const;

type NumKey = (typeof NUM_FIELDS)[number]['key'];

interface Row {
  key: string;
  id?: string;
  materialCatalogId: string | null;
  materialLabel: string | null; // tên CHUẨN đã chọn (mã — tên) — chỉ hiển thị
  alias: string; // "tên gọi khác" do xã tự đặt → lưu vào aliasUsed
  reservePurpose: string;
  note: string;
  closingAuto: boolean;
  nums: Record<NumKey, string>;
}

const emptyNums = (): Record<NumKey, string> =>
  Object.fromEntries(NUM_FIELDS.map((f) => [f.key, ''])) as Record<NumKey, string>;

let seq = 0;
const newKey = () => `r${Date.now()}-${seq++}`;

function toRow(l: DeclarationLine): Row {
  const n = (v: string | null) => (v == null || Number(v) === 0 ? '' : String(Number(v)));
  const std = l.materialName ? `${l.materialCode ? l.materialCode + ' — ' : ''}${l.materialName}` : null;
  return {
    key: newKey(),
    id: l.id,
    materialCatalogId: l.materialCatalogId,
    materialLabel: std ?? l.aliasUsed ?? null,
    alias: l.aliasUsed ?? '',
    reservePurpose: l.reservePurpose,
    note: l.note ?? '',
    closingAuto: false,
    nums: {
      openingQty: n(l.openingQty), increaseQty: n(l.increaseQty), decreaseQty: n(l.decreaseQty),
      closingQty: n(l.closingQty ?? l.quantity),
      inUseQty: n(l.inUseQty), ministryStoreQty: n(l.ministryStoreQty), unitStoreQty: n(l.unitStoreQty),
      qtyGrade1: n(l.qtyGrade1), qtyGrade2: n(l.qtyGrade2), qtyGrade3: n(l.qtyGrade3),
      qtyGrade4: n(l.qtyGrade4), qtyGrade5: n(l.qtyGrade5), unitPrice: n(l.unitPrice),
    },
  };
}

const emptyRow = (): Row => ({
  key: newKey(), materialCatalogId: null, materialLabel: null, alias: '',
  reservePurpose: 'THUONG_XUYEN', note: '', closingAuto: true, nums: emptyNums(),
});

const num = (s: string) => Number(s) || 0;

// Cảnh báo đối chiếu client-side (đồng bộ với reconcileLine ở backend).
function rowWarnings(r: Row): string[] {
  const w: string[] = [];
  const closing = num(r.nums.closingQty);
  const computed = num(r.nums.openingQty) + num(r.nums.increaseQty) - num(r.nums.decreaseQty);
  if ((num(r.nums.openingQty) || num(r.nums.increaseQty) || num(r.nums.decreaseQty)) && Math.abs(closing - computed) > 0.001) {
    w.push(`Cuối kỳ (${closing}) ≠ đầu kỳ + tăng − giảm (${computed})`);
  }
  const loc = num(r.nums.inUseQty) + num(r.nums.ministryStoreQty) + num(r.nums.unitStoreQty);
  if (loc > 0 && Math.abs(loc - closing) > 0.001) w.push(`Tổng vị trí kho (${loc}) ≠ cuối kỳ (${closing})`);
  const grades = num(r.nums.qtyGrade1) + num(r.nums.qtyGrade2) + num(r.nums.qtyGrade3) + num(r.nums.qtyGrade4) + num(r.nums.qtyGrade5);
  if (grades > 0 && Math.abs(grades - closing) > 0.001) w.push(`Tổng C1–C5 (${grades}) ≠ cuối kỳ (${closing})`);
  return w;
}

export function DeclarationGrid({
  declarationId,
  lines,
  editable,
  onSaved,
}: {
  declarationId: string;
  lines: DeclarationLine[];
  editable: boolean;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => lines.map(toRow));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showTpl, setShowTpl] = useState(false);

  const totalWarn = useMemo(() => rows.reduce((s, r) => s + rowWarnings(r).length, 0), [rows]);

  const mark = () => setDirty(true);

  const patch = (key: string, fn: (r: Row) => Row) => {
    setRows((prev) => prev.map((r) => (r.key === key ? fn(r) : r)));
    mark();
  };

  const setNum = (key: string, field: NumKey, value: string) => {
    patch(key, (r) => {
      const nums = { ...r.nums, [field]: value };
      let closingAuto = r.closingAuto;
      if (field === 'closingQty') closingAuto = false;
      if (['openingQty', 'increaseQty', 'decreaseQty'].includes(field) && closingAuto) {
        const c = num(nums.openingQty) + num(nums.increaseQty) - num(nums.decreaseQty);
        nums.closingQty = c ? String(c) : '';
      }
      return { ...r, nums, closingAuto };
    });
  };

  const addRows = (count: number) => { setRows((prev) => [...prev, ...Array.from({ length: count }, emptyRow)]); mark(); };
  // Thêm hàng loạt mã vật chất (từ "Thêm cả nhóm" / "Biểu mẫu") — bỏ qua mã đã có. Trả về số dòng thực thêm.
  const addMaterialRows = (items: { id: string; label: string }[]): number => {
    const existing = new Set(rows.map((r) => r.materialCatalogId).filter(Boolean) as string[]);
    const toAdd: Row[] = [];
    for (const it of items) {
      if (existing.has(it.id)) continue;
      existing.add(it.id);
      toAdd.push({ ...emptyRow(), materialCatalogId: it.id, materialLabel: it.label });
    }
    if (toAdd.length) { setRows((prev) => [...prev, ...toAdd]); mark(); }
    return toAdd.length;
  };
  const dupRow = (key: string) => setRows((prev) => {
    const i = prev.findIndex((r) => r.key === key);
    if (i < 0) return prev;
    const copy: Row = { ...prev[i], key: newKey(), id: undefined, nums: { ...prev[i].nums } };
    const out = [...prev]; out.splice(i + 1, 0, copy); return out;
  });
  const removeRow = (key: string) => {
    setRows((prev) => {
      const r = prev.find((x) => x.key === key);
      if (r?.id) setRemovedIds((ids) => [...ids, r.id!]);
      return prev.filter((x) => x.key !== key);
    });
    mark();
  };

  // Dán khối TSV từ Excel bắt đầu ở ô (rowIdx, fieldIdx); tự thêm dòng nếu tràn.
  const onPasteCell = (rowIdx: number, fieldIdx: number) => (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !/[\t\n]/.test(text)) return; // dán 1 ô → để mặc định
    e.preventDefault();
    const matrix = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    setRows((prev) => {
      const next = [...prev];
      matrix.forEach((cells, dr) => {
        while (rowIdx + dr >= next.length) next.push(emptyRow());
        const target = { ...next[rowIdx + dr], nums: { ...next[rowIdx + dr].nums } };
        cells.forEach((val, dc) => {
          const f = NUM_FIELDS[fieldIdx + dc];
          if (!f) return;
          const v = val.trim().replace(/,/g, '');
          target.nums[f.key] = v;
        });
        // auto cuối kỳ nếu chưa nhập tay
        if (target.closingAuto) {
          const c = num(target.nums.openingQty) + num(target.nums.increaseQty) - num(target.nums.decreaseQty);
          if (c) target.nums.closingQty = String(c);
        }
        next[rowIdx + dr] = target;
      });
      return next;
    });
    mark();
    toast.info(`Đã dán ${matrix.length} dòng số từ Excel.`);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payloadLines = rows
        .filter((r) => r.materialCatalogId)
        .map((r, i) => ({
          id: r.id,
          materialCatalogId: r.materialCatalogId,
          aliasUsed: r.alias.trim() || undefined,
          reservePurpose: r.reservePurpose,
          note: r.note || undefined,
          sortOrder: i,
          ...Object.fromEntries(NUM_FIELDS.map((f) => [f.key, num(r.nums[f.key])])),
        }));
      return (await api.post(`/material-declarations/${declarationId}/lines/bulk`, {
        lines: payloadLines,
        deleteIds: removedIds,
      })).data;
    },
    onSuccess: () => {
      toast.success('Đã lưu dòng vật chất.');
      setRemovedIds([]);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['material-declarations', declarationId] });
      onSaved?.();
    },
    onError: (e) => toast.problem(e, 'Lưu dòng thất bại'),
  });

  const missingMaterial = rows.filter((r) => !r.materialCatalogId).length;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>Dòng vật chất ({rows.length})</b>
        {totalWarn > 0 && (
          <span style={{ color: 'var(--warn-fg)', fontSize: 12.5, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <Icon name="alert" size={13} /> {totalWarn} cảnh báo đối chiếu
          </span>
        )}
        {editable && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => addRows(1)}><Icon name="plus" size={13} /> Thêm dòng</button>
            <button className="btn btn-sm" onClick={() => addRows(10)}>+10 dòng</button>
            <button className="btn btn-sm" onClick={() => setShowGroup(true)}><Icon name="grid" size={13} /> Thêm cả nhóm</button>
            <button className="btn btn-sm" onClick={() => setShowTpl(true)}><Icon name="clipboard" size={13} /> Biểu mẫu</button>
            <button className="btn btn-primary btn-sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              <Icon name="check" size={14} /> {save.isPending ? 'Đang lưu…' : 'Lưu dòng'}
            </button>
          </div>
        )}
      </div>

      {missingMaterial > 0 && editable && (
        <div className="muted" style={{ fontSize: 12.5 }}>
          {missingMaterial} dòng chưa chọn vật chất — sẽ bỏ qua khi lưu.
        </div>
      )}

      <div className="panel scrl" style={{ overflow: 'auto', maxHeight: '62vh' }}>
        <table className="data" style={{ minWidth: 1180, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}></th>
              <th style={{ minWidth: 230 }}>Vật chất (danh mục chuẩn)</th>
              <th style={{ minWidth: 150 }}>Tên gọi khác</th>
              <th style={{ minWidth: 130 }}>Mục đích</th>
              {NUM_FIELDS.map((f) => (
                <th key={f.key} style={{ textAlign: 'right', minWidth: f.group === 'q' ? 56 : 84 }}>{f.label}</th>
              ))}
              <th style={{ minWidth: 140 }}>Ghi chú</th>
              {editable && <th style={{ width: 70 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5 + NUM_FIELDS.length} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                Chưa có dòng. Bấm "Thêm dòng", "Nhập Excel/CSV" hoặc "Kế thừa kỳ trước".
              </td></tr>
            )}
            {rows.map((r, rowIdx) => {
              const warns = rowWarnings(r);
              return (
                <tr key={r.key} style={warns.length ? { background: 'var(--warn-bg)' } : undefined}>
                  <td style={{ textAlign: 'center', color: 'var(--color-neutral-500)' }}>
                    {warns.length ? <span title={warns.join('\n')} style={{ color: 'var(--warn-fg)', cursor: 'help' }}><Icon name="alert" size={14} /></span> : rowIdx + 1}
                  </td>
                  <td>
                    {editable ? (
                      <CascadingMaterialPicker
                        value={r.materialCatalogId}
                        label={r.materialLabel}
                        onPick={(id, label) => patch(r.key, (x) => ({ ...x, materialCatalogId: id, materialLabel: label }))}
                      />
                    ) : (r.materialLabel ?? r.materialCatalogId)}
                  </td>
                  <td>
                    {editable ? (
                      <input
                        value={r.alias}
                        onChange={(e) => patch(r.key, (x) => ({ ...x, alias: e.target.value }))}
                        placeholder="Tên địa phương…"
                        title="Tên gọi khác do xã tự đặt (không thay mã chuẩn)"
                        style={{ width: '100%', padding: '4px 6px' }}
                      />
                    ) : (r.alias || '—')}
                  </td>
                  <td>
                    {editable ? (
                      <select value={r.reservePurpose} onChange={(e) => patch(r.key, (x) => ({ ...x, reservePurpose: e.target.value }))} style={{ width: '100%' }}>
                        {PURPOSES.map((p) => <option key={p} value={p}>{RESERVE_PURPOSE_LABEL[p]}</option>)}
                      </select>
                    ) : RESERVE_PURPOSE_LABEL[r.reservePurpose] ?? r.reservePurpose}
                  </td>
                  {NUM_FIELDS.map((f, fieldIdx) => (
                    <td key={f.key} style={{ textAlign: 'right' }}>
                      {editable ? (
                        <input
                          type="number" step="0.001" value={r.nums[f.key]}
                          onChange={(e) => setNum(r.key, f.key, e.target.value)}
                          onPaste={onPasteCell(rowIdx, fieldIdx)}
                          className="num"
                          style={{ width: f.group === 'q' ? 52 : 80, textAlign: 'right', padding: '4px 6px' }}
                        />
                      ) : (r.nums[f.key] ? Number(r.nums[f.key]).toLocaleString('vi-VN') : '-')}
                    </td>
                  ))}
                  <td>
                    {editable ? (
                      <input value={r.note} onChange={(e) => patch(r.key, (x) => ({ ...x, note: e.target.value }))} style={{ width: '100%', padding: '4px 6px' }} />
                    ) : r.note}
                  </td>
                  {editable && (
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" title="Nhân bản dòng" onClick={() => dupRow(r.key)}><Icon name="clipboard" size={13} /></button>
                      <button className="btn btn-ghost btn-sm" title="Xóa dòng" onClick={() => removeRow(r.key)}>✕</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Icon name="check" size={14} /> {save.isPending ? 'Đang lưu…' : dirty ? 'Lưu dòng' : 'Đã lưu'}
          </button>
        </div>
      )}

      {showGroup && <AddGroupModal onClose={() => setShowGroup(false)} onAdd={addMaterialRows} />}
      {showTpl && (
        <TemplateModal
          currentItems={rows.filter((r) => r.materialCatalogId).map((r) => ({ materialCatalogId: r.materialCatalogId as string, label: r.materialLabel ?? (r.materialCatalogId as string) }))}
          onApply={addMaterialRows}
          onClose={() => setShowTpl(false)}
        />
      )}
    </div>
  );
}
