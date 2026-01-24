import { Injectable } from '@nestjs/common';
import { ArticleRepository, UserRepository } from '../common/repositories';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleDto } from './dto/article.dto';
import { plainToInstance } from 'class-transformer';
import { BusinessException } from '../common/exceptions';
import { BusinessErrorCodes } from '../common/constants/business-error-codes';

@Injectable()
export class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getAll(): Promise<ArticleDto[]> {
    const articles = await this.articleRepo.findAllWithAuthor();
    return plainToInstance(ArticleDto, articles, {
      excludeExtraneousValues: true,
    });
  }

  async create(data: CreateArticleDto): Promise<ArticleDto> {
    const author = await this.userRepo.findById(data.authorId);
    if (!author) {
      throw new BusinessException(
        BusinessErrorCodes.NOT_FOUND,
        `著者（ID: ${data.authorId}）が見つかりませんでした`,
      );
    }
    const article = await this.articleRepo.save({
      title: data.title,
      content: data.content,
      author,
    });
    return plainToInstance(ArticleDto, article, {
      excludeExtraneousValues: true,
    });
  }
}
