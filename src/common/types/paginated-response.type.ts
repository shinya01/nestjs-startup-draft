// src/common/types/paginated-response.type.ts
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export class PaginatedResponse<T> {
  success: boolean;
  statusCode: number;
  timestamp: string;
  path: string;
  data: T[];
  meta: PaginationMeta;
}
