import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeneratedQuestion {
  label: string;
  type: 'text' | 'number' | 'scale' | 'single_choice' | 'multiple_choice' | 'date' | 'boolean';
  required: boolean;
  options: string[];
  validation?: { min?: number; max?: number };
  order: number;
}



@Injectable()
export class AiService {

  private genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  async generateQuestions(
    medicalService: string,
    title: string,
    description: string,
    count: number = 7
  ): Promise<GeneratedQuestion[]> {

    const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `You are a medical professional creating a post-hospitalization follow-up questionnaire.

Medical service: ${medicalService}
Questionnaire title: ${title}
Description: ${description || 'Post-hospitalization follow-up'}
Number of questions: ${count}

Generate exactly ${count} relevant medical follow-up questions.
Types available: text, number, scale, single_choice, multiple_choice, date, boolean

Rules:
- Pain → scale (min:1, max:10)
- Temperature → number (min:35, max:42)
- Yes/No → boolean
- Multiple symptoms → multiple_choice with options
- Single choice → single_choice with options

Respond ONLY with a valid JSON array, no markdown, no explanation:
[{"label":"...","type":"scale","required":true,"options":[],"validation":{"min":1,"max":10},"order":0}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const questions: GeneratedQuestion[] = JSON.parse(text);
    return questions.map((q, i) => ({ ...q, order: i }));
  }

  // summary for patients responses
async generatePatientSummary(
  patientName: string,
  medicalService: string,
  allResponses: any[]   // tableau de toutes les réponses du patient
): Promise<string> {

  const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const prompt = `You are an experienced physician writing a concise medical summary for a colleague.

Patient: ${patientName}
Medical Service: ${medicalService}

Here are all the responses submitted by the patient:

${JSON.stringify(allResponses, null, 2)}

Generate a **professional, readable and concise** medical summary (maximum 6-7 lines).
Focus on:
- Key symptoms and their evolution
- Pain level, temperature, medication adherence
- Red flags (if any)
- Overall trend
- One clear recommendation

Write in a natural, clinical tone. Do not use bullet points.`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Nettoyage
  text = text.replace(/```[\s\S]*?```/g, '').trim();

  return text;
}
}
