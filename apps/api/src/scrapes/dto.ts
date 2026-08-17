import { IsOptional, IsUrl, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScrapeDto {
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
    url!: string;
    @IsOptional()
    telegramUserId?: string;
}

export class ListScrapesDto {
    @IsOptional()
    @IsIn(['VIDEO', 'PROFILE'])
    type?: 'VIDEO' | 'PROFILE';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    order?: 'asc' | 'desc';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}

