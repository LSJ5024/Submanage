import type { ApiError, ApiResponse } from './types/index.js';

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

export function errorResponse(code: string, message: string): ApiResponse<null> {
  const error: ApiError = { code, message };
  return { success: false, data: null, error };
}
