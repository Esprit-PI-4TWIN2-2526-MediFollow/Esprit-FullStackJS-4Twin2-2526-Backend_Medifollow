import { Body, Controller, Get, Post } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { TranslateDto } from './dto/translate.dto';

@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Post('translate')
  async translate(@Body() dto: TranslateDto) {
    return this.i18nService.translate(dto);
  }

  @Post('translate/batch')
  async translateBatch(
    @Body() body: { texts: string[]; sourceLang: string; targetLang: string },
  ) {
    const translated = await this.i18nService.translateBatch(
      body.texts,
      body.sourceLang,
      body.targetLang,
    );
    return { translated };
  }

  @Get('cache/stats')
  async cacheStats() {
    return this.i18nService.getCacheStats();
  }
}