import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateScrapeDto, ListScrapesDto } from './dto';
import { ScrapesService } from './scrapes.service';

@Controller('scrapes')
export class ScrapesController {
  constructor(private readonly scrapes: ScrapesService) {}
  @Post() create(@Body() body: CreateScrapeDto) { return this.scrapes.create(body); }
  @Get() findAll(@Query() query: ListScrapesDto) { return this.scrapes.findAll(query); }
}
