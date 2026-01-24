// src/common/types/success-response.type.ts
export class SuccessResponse<T> {
  success: boolean;
  statusCode: number;
  timestamp: string;
  path: string;
  data?: T;
}
