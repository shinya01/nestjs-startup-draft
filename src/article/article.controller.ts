import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleDto } from './dto/article.dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  ApiAuthErrorResponses,
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Articles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiAuthErrorResponses()
@ApiErrorResponses()
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: '全記事を取得' })
  @ApiSuccessResponse({ model: ArticleDto, isArray: true })
  getAll() {
    return this.articleService.getAll();
  }

  @Post()
  @ApiOperation({ summary: '記事を作成' })
  @ApiBody({ type: CreateArticleDto })
  @ApiSuccessResponse({
    model: ArticleDto,
    description: '記事作成成功',
    statusCode: 201,
  })
  create(@Body() body: CreateArticleDto) {
    return this.articleService.create(body);
  }
}
