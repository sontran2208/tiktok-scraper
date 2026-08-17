import { Controller, Get } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';

@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheets: GoogleSheetsService) {}

  @Get('verify')
  verify() { return this.sheets.verify(); }
}
