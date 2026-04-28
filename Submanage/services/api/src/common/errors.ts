export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = '리소스를 찾을 수 없습니다.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '인증이 필요합니다.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '접근 권한이 없습니다.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, 'BAD_REQUEST', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class InternalServerError extends AppError {
  constructor(message = '서버 내부 오류가 발생했습니다.') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
