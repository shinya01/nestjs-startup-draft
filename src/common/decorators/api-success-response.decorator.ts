// src/common/decorators/api-success-response.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  ApiNoContentResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import { SuccessResponseDto } from '../swagger/success-response.dto';

type StatusCode = 200 | 201 | 202 | 204;
type StatusOption = StatusCode | 'auto';

interface ApiSuccessResponseOptions<TModel extends Type<unknown>> {
  model: TModel;
  isArray?: boolean;
  description?: string;
  statusCode?: StatusOption;
}

const statusToDecorator = {
  200: ApiOkResponse,
  201: ApiCreatedResponse,
  202: ApiAcceptedResponse,
  204: ApiNoContentResponse,
} as const;

export function ApiSuccessResponse<TModel extends Type<unknown>>(
  options: ApiSuccessResponseOptions<TModel>,
) {
  const {
    model,
    isArray = false,
    description = '成功レスポンス',
    statusCode = 'auto',
  } = options;

  const resolvedStatus: StatusCode =
    statusCode === 'auto'
      ? model.name.toLowerCase().includes('create') ||
        model.name.toLowerCase().includes('post')
        ? 201
        : 200
      : statusCode;

  const responseDecorator = statusToDecorator[resolvedStatus] ?? ApiOkResponse;

  const schema =
    resolvedStatus === 204
      ? {}
      : {
          allOf: [
            { $ref: getSchemaPath(SuccessResponseDto) },
            {
              properties: {
                data: isArray
                  ? {
                      type: 'array',
                      items: { $ref: getSchemaPath(model) },
                      nullable: true,
                    }
                  : {
                      allOf: [{ $ref: getSchemaPath(model) }],
                      nullable: true,
                    },
              },
            },
          ],
        };

  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, model),
    responseDecorator({
      description,
      schema,
    }),
  );
}
