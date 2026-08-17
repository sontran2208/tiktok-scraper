import { IsOptional, IsUrl, IsIn } from 'class-validator';
export class CreateScrapeDto { @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string; @IsOptional() telegramUserId?: string; }
export class ListScrapesDto { @IsOptional() @IsIn(['VIDEO', 'PROFILE']) type?: 'VIDEO' | 'PROFILE'; @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc'; }
