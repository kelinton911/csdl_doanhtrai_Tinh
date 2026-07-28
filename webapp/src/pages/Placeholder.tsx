import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';

// Trang tạm cho màn hình sẽ hoàn thiện ở pha sau (giữ điều hướng thông suốt).
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <>
      <PageHeader eyebrow="Đang phát triển" title={title} />
      <EmptyState
        icon="clock"
        title={`Màn hình "${title}" sẽ hoàn thiện ở ${phase}`}
        hint="Backend và giao diện của mục này đang được xây dựng theo lát cắt dọc. Vui lòng quay lại sau."
      />
    </>
  );
}
