// src/common/decorators/api-success-response.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';
import { SuccessResponseDto } from '../swagger/success-response.dto';

export function ApiSuccessResponse<TModel extends Type<unknown>>(
  model: TModel,
  isArray = false,
  description = '成功レスポンス',
) {
  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          {
            properties: {
              data: isArray
                ? {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  }
                : { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}
