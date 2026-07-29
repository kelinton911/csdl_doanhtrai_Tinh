import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { AssetCodePicker } from './AssetCodePicker';
import { toast } from '../lib/toast';
import {
  allocateProposalCode,
  batchDownloadUrl,
  createBatch,
  createProposal,
  deleteProposal,
  exportBatch,
  previewProposalCode,
  submitProposal,
  useProposalBatches,
  useProposals,
  type AssetNode,
  type Proposal,
  type ProposalBatch,
} from '../lib/assetCatalog';

// Đề xuất bổ sung danh mục tài sản ngành Doanh trại — đáp ứng Công văn 2837/DT-QLDT
// ngày 16/7/2026 của Cục Doanh trại/TCHC-KT (hạn gửi kèm file dữ liệu: 30/8/2026).

function NewProposalModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [parent, setParent] = useState<AssetNode | null>(null);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  const [unitRaw, setUnitRaw] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!parent || !name.trim()) return;
    setBusy(true);
    try {
      await createProposal({
        parentCode: parent.code,
        name: name.trim(),
        unitRaw: unitRaw.trim() || null,
        justification: why.trim() || null,
      });
      toast.success('Đã tạo đề xuất (nháp).');
      onDone();
    } catch (e) {
      toast.problem(e, 'Không tạo được đề xuất');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open title="Đề xuất bổ sung mục mới" onClose={onClose} width={620}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="field-label">Nhóm cha trong danh mục chính thức</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn" onClick={() => setPicking(true)}>
                <Icon name="search" size={14} /> {parent ? 'Đổi nhóm cha' : 'Chọn nhóm cha'}
              </button>
              {parent && <span className="num" style={{ fontSize: 12 }}>{parent.code}</span>}
            </div>
            {parent && (
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{parent.pathNames}</div>
            )}
            {parent?.isLeaf && (
              <div style={{ fontSize: 12, color: 'var(--color-warning, #a15c00)', marginTop: 4 }}>
                Nút cha đang là mục cụ thể — bổ sung mục con sẽ chuyển nó thành nhóm.
                Đây là quyết định của Cục Doanh trại, sẽ được ghi rõ trong văn bản đề xuất.
              </div>
            )}
          </div>
          <div>
            <label className="field-label">Tên tài sản đề xuất</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ghi đúng tên nghiệp vụ, thống nhất cách viết với phụ lục" />
          </div>
          <div>
            <label className="field-label">ĐVT (ghi đúng cách viết trong phụ lục, vd: Cái, m2, m2 SD, HT)</label>
            <input className="input" value={unitRaw} onChange={(e) => setUnitRaw(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Lý do đề xuất</label>
            <textarea className="input" rows={3} value={why} onChange={(e) => setWhy(e.target.value)}
              placeholder="Vd: đơn vị đang quản lý, sử dụng nhưng chưa có mã trong phụ lục hiện hành." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={!parent || !name.trim() || busy} onClick={save}>
              Tạo đề xuất
            </button>
          </div>
        </div>
      </Modal>
      <AssetCodePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(n) => setParent(n)}
        title="Chọn nhóm cha cho mục đề xuất"
      />
    </>
  );
}

export function ProposalPanel() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const proposals = useProposals(page, 20);
  const batches = useProposalBatches();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['asset-catalog', 'proposals'] });
    qc.invalidateQueries({ queryKey: ['asset-catalog', 'batches'] });
  };

  const doAllocate = async (p: Proposal) => {
    try {
      // Xem trước trước khi chốt để người dùng thấy mã và căn cứ suy ra nó.
      const pv = await previewProposalCode(p.id);
      const note = pv.inferredFrom === 'parent-level'
        ? '\n\nLƯU Ý: nhánh này chưa có mục con nào, vị trí mã là SUY ĐOÁN theo cấp của nhóm cha.'
        : `\n\nSuy từ ${pv.siblingCount} mục con hiện có của nhóm cha.`;
      if (!window.confirm(`Cấp mã ${pv.code} cho "${p.name}"?${note}`)) return;
      await allocateProposalCode(p.id);
      toast.success(`Đã cấp mã ${pv.code}.`);
      refresh();
    } catch (e) {
      toast.problem(e, 'Không cấp được mã');
    }
  };

  const doSubmit = async (p: Proposal) => {
    try {
      await submitProposal(p.id);
      toast.success('Đã trình đề xuất.');
      refresh();
    } catch (e) {
      toast.problem(e, 'Không trình được đề xuất');
    }
  };

  const doDelete = async (p: Proposal) => {
    if (!window.confirm(`Xoá đề xuất "${p.name}"?`)) return;
    try {
      await deleteProposal(p.id);
      toast.success('Đã xoá đề xuất.');
      refresh();
    } catch (e) {
      toast.problem(e, 'Không xoá được');
    }
  };

  const newBatch = async () => {
    const code = window.prompt('Mã lô gửi (vd DX-2026-08):', 'DX-2026-08');
    if (!code) return;
    try {
      await createBatch({
        code,
        title: 'Đề xuất bổ sung danh mục tài sản ngành Doanh trại',
        deadline: '2026-08-30',
      });
      toast.success('Đã tạo lô gửi.');
      refresh();
    } catch (e) {
      toast.problem(e, 'Không tạo được lô');
    }
  };

  const doExport = async (b: ProposalBatch) => {
    try {
      const r = await exportBatch(b.id);
      toast.success(`Đã xuất ${r.rowCount} dòng ra Excel.`);
      refresh();
    } catch (e) {
      toast.problem(e, 'Không xuất được');
    }
  };

  const doDownload = async (b: ProposalBatch) => {
    try {
      const { url } = await batchDownloadUrl(b.id);
      window.open(url, '_blank');
    } catch (e) {
      toast.problem(e, 'Không tải được tệp');
    }
  };

  const propCols: Column<Proposal>[] = [
    {
      key: 'code', header: 'Mã đề xuất', mono: true, width: 168,
      render: (p) => p.proposedCode ?? <span className="muted">chưa cấp</span>,
    },
    {
      key: 'name', header: 'Tên tài sản',
      render: (p) => (
        <div>
          <span style={{ fontWeight: 600 }}>{p.name}</span>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            dưới nhóm {p.parentCode}
            {p.requiresParentPromotion && ' · nhóm cha sẽ chuyển từ mục cụ thể thành nhóm'}
          </div>
        </div>
      ),
    },
    { key: 'unit', header: 'ĐVT', width: 74, render: (p) => p.unitRaw ?? '—' },
    { key: 'st', header: 'Trạng thái', width: 108, render: (p) => <span className="muted">{p.status}</span> },
    {
      key: 'act', header: 'Hành động', width: 250,
      render: (p) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {!p.proposedCode && (
            <button className="btn btn-sm btn-primary" onClick={() => doAllocate(p)}>Cấp mã</button>
          )}
          {p.proposedCode && p.status === 'DRAFT' && (
            <button className="btn btn-sm btn-primary" onClick={() => doSubmit(p)}>Trình</button>
          )}
          {p.status !== 'EXPORTED' && (
            <button className="btn btn-sm" onClick={() => doDelete(p)}>Xoá</button>
          )}
        </div>
      ),
    },
  ];

  const batchCols: Column<ProposalBatch>[] = [
    { key: 'code', header: 'Mã lô', mono: true, width: 130, render: (b) => b.code },
    { key: 'title', header: 'Tên lô', render: (b) => b.title },
    { key: 'dl', header: 'Hạn gửi', width: 110, render: (b) => b.deadline ?? '—' },
    { key: 'n', header: 'Số dòng', width: 84, align: 'right', render: (b) => b.rowCount },
    { key: 'st', header: 'Trạng thái', width: 108, render: (b) => <span className="muted">{b.status}</span> },
    {
      key: 'act', header: 'Hành động', width: 260,
      render: (b) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-primary" onClick={() => doExport(b)}>Xuất Excel</button>
          {b.status === 'EXPORTED' && (
            <button className="btn btn-sm" onClick={() => doDownload(b)}>
              <Icon name="download" size={13} /> Tải về
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ padding: '12px 16px', fontSize: 13 }}>
        Đáp ứng <strong>Công văn 2837/DT-QLDT ngày 16/7/2026</strong> của Cục Doanh trại/TCHC-KT:
        rà soát, đề xuất bổ sung danh mục tài sản ngành Doanh trại, gửi kèm file dữ liệu
        <strong> trước 30/8/2026</strong>. Tệp xuất theo đúng 4 cột của phụ lục gốc
        (STT · Mã vật tư · Tên vật tư · ĐVT).
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Đề xuất bổ sung</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> Thêm đề xuất
          </button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <DataTable columns={propCols} rows={proposals.data?.data} loading={proposals.isLoading}
            rowKey={(p) => p.id} emptyTitle="Chưa có đề xuất nào"
            emptyHint="Thêm đề xuất từ đây, hoặc từ tab “Rà soát thiếu mã”." />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Lô gửi Cục Doanh trại</h3>
          <button className="btn btn-sm" onClick={newBatch}>
            <Icon name="plus" size={14} /> Tạo lô gửi
          </button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <DataTable columns={batchCols} rows={batches.data} loading={batches.isLoading}
            rowKey={(b) => b.id} emptyTitle="Chưa có lô gửi nào"
            emptyHint="Tạo lô rồi bấm “Xuất Excel” để gom các đề xuất đã trình." />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Xuất Excel sẽ gom mọi đề xuất ở trạng thái “Đã trình” chưa thuộc lô nào. Sổ gồm 3 trang:
          <em> Bổ sung</em> (định dạng nộp), <em>Ngữ cảnh</em> (vị trí trong cây, lý do),
          và <em>Đối chiếu gốc</em> (1272 mã nguyên văn, kèm SHA-256 của bản phụ lục).
        </div>
      </div>

      {creating && (
        <NewProposalModal onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); refresh(); }} />
      )}
    </div>
  );
}
