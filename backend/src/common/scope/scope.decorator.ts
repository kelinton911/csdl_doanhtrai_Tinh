import { SetMetadata } from '@nestjs/common';
import { ScopeDimension } from './scope-context';

export const SCOPED_KEY = 'scoped_dimensions';

// Đánh dấu handler/controller cần cưỡng chế phạm vi dữ liệu theo các chiều chỉ định.
// Ví dụ: @Scoped('organization') hoặc @Scoped('organization', 'area').
// DataScopeGuard sẽ đọc metadata này, đối chiếu giá trị yêu cầu (param/query/body)
// với phạm vi trong token; vượt phạm vi → 403 NO_PERMISSION_SCOPE.
export const Scoped = (...dimensions: ScopeDimension[]) =>
  SetMetadata(SCOPED_KEY, dimensions);
