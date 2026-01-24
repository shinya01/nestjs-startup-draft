// src/common/interceptors/response-transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SuccessResponse } from '../types/success-response.type';

@Injectable()
export class ResponseTransformInterceptor<
  T = unknown,
> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    const ctx = context.switchToHttp();
    const request: Request = ctx.getRequest();
    const response: Response = ctx.getResponse();

    return next.handle().pipe(
      map((data: T): SuccessResponse<T> => {
        const base = {
          success: true,
          statusCode: response.statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
        return response.statusCode === 204
          ? (base as SuccessResponse<T>)
          : { ...base, data };
      }),
    );
  }
}
