// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions';

const logger = new Logger('HttpExceptionFilter');

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);

    const responseBody: Record<string, any> = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error:
        exception instanceof HttpException
          ? exception.name
          : 'InternalServerError',
    };

    if (exception instanceof BusinessException) {
      responseBody.code = exception.code;

      logger.warn({
        type: 'BusinessException',
        code: exception.code,
        message,
        cause: exception.cause,
        statusCode: status,
        path: request.url,
      });
    } else if (exception instanceof HttpException) {
      logger.error({
        type: 'HttpException',
        message,
        statusCode: status,
        path: request.url,
      });
    } else {
      logger.error({
        type: 'UnknownException',
        message,
        statusCode: status,
        path: request.url,
      });
    }

    response.status(status).json(responseBody);
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') return res;
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as Record<string, unknown>).message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'An unexpected error occurred';
  }
}
