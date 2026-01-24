// src/common/constants/business-error-codes.ts
export const BusinessErrorCodes = {
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  // 必要に応じて追加
} as const;

export type BusinessErrorCode =
  (typeof BusinessErrorCodes)[keyof typeof BusinessErrorCodes];
