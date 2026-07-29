import { useState } from 'react';
import { STYLES, SymbolStyle, legendSvg } from '../lib/milSymbols';
import { Modal } from './Modal';
import { Icon } from './Icon';

interface SymbolPickerProps {
  value: string; // symbol key
  onChange: (key: string) => void;
  label?: string;
}

export function MilitarySymbolPicker({ value, onChange, label = 'Phân loại Ký hiệu Quân sự' }: SymbolPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const currentSymbol = STYLES[value] ?? STYLES.default;

  // Gom nhóm ký hiệu
  const groups: Record<string, SymbolStyle[]> = {};
  Object.values(STYLES).forEach((st) => {
    if (!groups[st.groupName]) groups[st.groupName] = [];
    groups[st.groupName].push(st);
  });

  return (
    <div>
      <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ padding: '0 4px', fontSize: 12, color: 'var(--color-primary-600)' }}
          onClick={() => setModalOpen(true)}
        >
          <Icon name="grid" size={13} /> Chọn từ Thư viện Ký hiệu
        </button>
      </label>

      {/* Thẻ xem trước Ký hiệu đang chọn */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '6px 12px',
          background: 'var(--surface-1)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--color-neutral-100)',
            border: '1px solid var(--color-neutral-300)',
          }}
          dangerouslySetInnerHTML={{ __html: legendSvg(currentSymbol) }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{currentSymbol.label}</div>
          <div className="muted num" style={{ fontSize: 11 }}>
            Mã: {currentSymbol.key} · Nhóm: {currentSymbol.groupName}
          </div>
        </div>
        <Icon name="chevron" size={16} />
      </button>

      {/* Modal Thư viện Ký hiệu Quân sự */}
      {modalOpen && (
        <Modal open title="Thư viện Ký hiệu Bản đồ Quân sự (SVG Catalog)" onClose={() => setModalOpen(false)} width={640}>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 16 }}>
            Chọn ký hiệu tác chiến tương ứng theo quy định quản lý CSDL địa bàn. Biểu tượng sẽ được tự động vẽ động lên bản đồ GIS.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '60vh', overflowY: 'auto' }} className="scrl">
            {Object.entries(groups).map(([groupTitle, symbols]) => (
              <div key={groupTitle}>
                <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--color-neutral-700)', borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: 4 }}>
                  {groupTitle} ({symbols.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {symbols.map((st) => {
                    const isSelected = st.key === value;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => {
                          onChange(st.key);
                          setModalOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid var(--color-primary-600)' : '1px solid var(--color-neutral-300)',
                          background: isSelected ? 'var(--color-primary-100, #eff6ff)' : 'var(--surface-1)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            flexShrink: 0,
                          }}
                          dangerouslySetInnerHTML={{ __html: legendSvg(st) }}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{st.label}</div>
                          <div className="num muted" style={{ fontSize: 10.5 }}>{st.key}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
