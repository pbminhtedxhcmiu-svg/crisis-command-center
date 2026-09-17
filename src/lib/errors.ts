// Error format thống nhất cho toàn bộ API
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthenticated = (m = "Yêu cầu đăng nhập") => new ApiError("UNAUTHENTICATED", m, 401);
export const forbidden = (m = "Bạn không có quyền thực hiện hành động này") =>
  new ApiError("FORBIDDEN", m, 403);
export const notFound = (m = "Không tìm thấy tài nguyên") => new ApiError("NOT_FOUND", m, 404);
export const validationError = (m: string, details?: unknown) =>
  new ApiError("VALIDATION_ERROR", m, 422, details);
export const conflict = (m: string) => new ApiError("CONFLICT", m, 409);
