import Axios, { AxiosError } from "axios";

export class Exception {
  statusCode: number;
  code: string | null;
  message: string;
  expose: boolean;

  constructor(message: string, code?: string, statusCode?: number) {
    this.statusCode = statusCode || 500;
    this.code = code || null;
    this.message = message;
    this.expose = true;
  }
}
export class InternalError extends Exception {
  constructor(message: string, code?: string) {
    super(message, code, 500);
  }
}
export class BadRequest extends Exception {
  constructor(message: string, code?: string) {
    super(message, code, 400);
  }
}
export class NotFound extends Exception {
  constructor(message: string, code?: string) {
    super(message, code, 404);
  }
}
export class Forbidden extends Exception {
  constructor(message: string, code?: string) {
    super(message, code, 403);
  }
}

export function extractErrorData(e: any) {
  if (Axios.isAxiosError(e)) {
    return e.response ? e.response.data : e.message;
  } else if (e.message) {
    return e.message;
  } else {
    return e;
  }
}

export function isErrorResponseExternalServerError(e: AxiosError<any>) {
  return e.response && e.response.status && e.response.status >= 500;
}

export function isErrorResponseUnauthorised(e: AxiosError<any>) {
  return e.response && e.response.status && e.response.status === 401;
}

export function isErrorResponseForbidden(e: AxiosError<any>) {
  return e.response && e.response.status && e.response.status === 403;
}
