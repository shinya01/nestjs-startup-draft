// src/common/repositories/article.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../entities';

@Injectable()
export class ArticleRepository {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
  ) {}

  async findAllWithAuthor(): Promise<Article[]> {
    return this.repo.find({
      relations: ['author'],
    });
  }

  async findById(id: number): Promise<Article | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['author'],
    });
  }

  async save(data: Partial<Article>): Promise<Article> {
    return this.repo.save(data);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
