// i18n.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import Groq from 'groq-sdk';
import { TranslateDto } from './dto/translate.dto';
import { Translation, TranslationDocument } from './schema/translation.schema';

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private groq: Groq;

  constructor(
    @InjectModel(Translation.name)
    private readonly translationModel: Model<TranslationDocument>,
  ) {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  // ─── Hash unique clé cache ─────────────────────────────────────────────────
  private buildCacheKey(text: string, sourceLang: string): string {
    return createHash('md5')
      .update(`${sourceLang}:${text.trim().toLowerCase()}`)
      .digest('hex');
  }

  // ─── Lecture cache MongoDB ─────────────────────────────────────────────────
  private async getFromCache(
    key: string,
    targetLang: string,
  ): Promise<string | null> {
    const cached = await this.translationModel
      .findOne({ key })
      .lean()
      .exec();

    if (cached?.translations) {
      const map = cached.translations as unknown as Record<string, string>;
      if (map[targetLang]) {
        this.logger.debug(`Cache HIT → ${key} [${targetLang}]`);
        return map[targetLang];
      }
    }
    return null;
  }

  // ─── Sauvegarde cache MongoDB ──────────────────────────────────────────────
  private async saveToCache(
    key: string,
    sourceText: string,
    sourceLang: string,
    targetLang: string,
    translatedText: string,
    provider: string,
  ): Promise<void> {
    await this.translationModel.findOneAndUpdate(
      { key },
      {
        $set: {
          sourceText,
          sourceLang,
          provider,
          [`translations.${targetLang}`]: translatedText,
        },
      },
      { upsert: true, new: true },
    );
    this.logger.debug(`Cache SAVED → ${key} [${targetLang}] via ${provider}`);
  }

  // ─── Traduction avec Groq ──────────────────────────────────────────────────
  private async translateWithGroq(
    text: string,
    targetLang: string,
    sourceLang: string = 'auto',
  ): Promise<string> {
    try {
      const languageMap: Record<string, string> = {
        'fr': 'French',
        'en': 'English',
        'ar': 'Arabic',
      };

      const targetLanguage = languageMap[targetLang] || targetLang;
      const sourceInstruction = sourceLang !== 'auto' 
        ? `from ${languageMap[sourceLang] || sourceLang}` 
        : '';

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a precise medical translator. Translate medical texts accurately, preserving all clinical terminology, dosages, and medical units. Never add extra text or explanations. Only return the translation.'
          },
          {
            role: 'user',
            content: `Translate the following medical text ${sourceInstruction} to ${targetLanguage}.\n\nMedical text: "${text}"\n\nTranslation:`
          },
        ],
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        temperature: 0.2,
        max_tokens: 2000,
      });

      const translated = completion.choices[0]?.message?.content?.trim();
      
      if (!translated) {
        throw new Error('Empty response from Groq');
      }
      
      return translated;
    } catch (error: any) {
      this.logger.error('Groq translation error:', error.message);
      throw new Error(`Groq translation failed: ${error.message}`);
    }
  }

  // ─── Méthode principale de traduction ──────────────────────────────────────
  async translate(dto: TranslateDto): Promise<{
    translatedText: string;
    fromCache: boolean;
    provider: string;
  }> {
    const { text, sourceLang, targetLang } = dto;

    // Même langue → retour direct
    if (sourceLang === targetLang) {
      return { translatedText: text, fromCache: true, provider: 'passthrough' };
    }

    const cacheKey = this.buildCacheKey(text, sourceLang);

    // 1. Vérifier le cache MongoDB
    const cached = await this.getFromCache(cacheKey, targetLang);
    if (cached) {
      return { translatedText: cached, fromCache: true, provider: 'cache' };
    }

    // 2. Traduire avec Groq
    try {
      const translated = await this.translateWithGroq(text, targetLang, sourceLang);

      await this.saveToCache(
        cacheKey,
        text,
        sourceLang,
        targetLang,
        translated,
        'groq',
      );

      return { 
        translatedText: translated, 
        fromCache: false, 
        provider: 'groq' 
      };
    } catch (error: any) {
      this.logger.error('=== GROQ TRANSLATION ERROR ===');
      this.logger.error('Message:', error.message);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  // ─── Traduction batch (pour plusieurs textes) ──────────────────────────────
  async translateBatch(
    texts: string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.translate({
          text: texts[i],
          sourceLang,
          targetLang,
        });
        results.push(result.translatedText);
      } catch (error: any) {
        this.logger.error(`Failed to translate text ${i}:`, error.message);
        results.push(texts[i]); // Fallback: garder le texte original
      }
    }
    
    return results;
  }

  // ─── Statistiques du cache ─────────────────────────────────────────────────
  async getCacheStats(): Promise<{
    total: number;
    byProvider: Record<string, number>;
  }> {
    const [total, byProvider] = await Promise.all([
      this.translationModel.countDocuments(),
      this.translationModel.aggregate([
        { $group: { _id: '$provider', count: { $sum: 1 } } },
      ]),
    ]);

    const byProviderMap = byProvider.reduce(
      (acc, { _id, count }) => ({ ...acc, [_id]: count }),
      {} as Record<string, number>,
    );

    return {
      total,
      byProvider: byProviderMap,
    };
  }
}