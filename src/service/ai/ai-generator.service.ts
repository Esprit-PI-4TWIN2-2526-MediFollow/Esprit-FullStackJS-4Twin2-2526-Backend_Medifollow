import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { GeneratedService } from './generated-service.interface';

@Injectable()
export class AiGeneratorService {

    private client = new Groq({
        apiKey: process.env.GROQ_API_KEY,
    });

    async generateService(description: string): Promise<GeneratedService> {
        if (!description?.trim()) {
            throw new BadRequestException('Description is required');
        }

        try {
            const completion = await this.client.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert medical assistant specializing in hospital service management.
Your mission: generate a complete hospital service record in JSON format.
ABSOLUTE RULE: You MUST always fill ALL fields of the JSON except 'telephone' and 'email'.
DO NOT generate any phone number or email. Always leave them empty or null.
ALL text values (name, description, location, etc.) MUST be written in ENGLISH.
Return ONLY raw JSON, no text before or after, no markdown tags.`,
                    },
                    {
                        role: 'user',
                        content: `Generate a complete hospital service record for: "${description}".

IMPORTANT: Invent and fill ALL fields realistically, but DO NOT provide telephone or email.
Return this fully populated JSON:
{
  "nom": "...",
  "description": "...",
  "type": "...",
  "localisation": "...",
  "telephone": "",
  "email": "",
  "capacite": ...,
  "tempsAttenteMoyen": ...,
  "estUrgence": ...,
  "statut": "ACTIF",
  "horaires": [...],
  "responsableId": ""
}`
                    },
                ],
                temperature: 0.4,
                max_tokens: 1500,
            });

            const raw = completion.choices[0]?.message?.content?.trim() ?? '';
            if (!raw) throw new InternalServerErrorException('Empty response from AI model');

            // Robust JSON extraction
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new SyntaxError('No JSON found in the response');

            const parsed = JSON.parse(jsonMatch[0]) as GeneratedService;

            if (!parsed.nom) throw new InternalServerErrorException('Field "nom" missing from AI response');

            // Final guarantees
            parsed.statut = 'ACTIF';
            parsed.responsableId = '';
            if (!Array.isArray(parsed.horaires)) parsed.horaires = [];

            // ALWAYS assign default email & phone
            parsed.telephone = '+216 70 102 300';
            parsed.email = 'medifollow@gmail.com';

            // Default values for other fields if missing
            parsed.capacite = parsed.capacite && parsed.capacite > 0 ? parsed.capacite : 20;
            parsed.tempsAttenteMoyen = parsed.tempsAttenteMoyen && parsed.tempsAttenteMoyen > 0 ? parsed.tempsAttenteMoyen : 30;
            parsed.localisation = parsed.localisation?.trim() || 'Main Building - Ground Floor';

            return parsed;

        } catch (err) {
            if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
            if (err instanceof SyntaxError) throw new InternalServerErrorException('AI response is not valid JSON');
            throw new InternalServerErrorException(`AI generation error: ${err.message}`);
        }
    }
}
