import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import Groq from 'groq-sdk';
import { User, UserDocument } from 'src/users/users.schema';
import { SymptomResponse, SymptomResponseDocument } from '../schemas/symptom-response.schema';

@Injectable()
export class SuggestionsService {
  private client: Groq;

  constructor(
    @InjectModel(SymptomResponse.name)
    private symptomResponseModel: Model<SymptomResponseDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async generateValidationSuggestions(
    responseId: string,
    department: string,
    patientContext?: string,
  ): Promise<string[]> {
    if (!responseId || !isValidObjectId(responseId)) {
      throw new Error('Invalid response ID');
    }

    const response = await this.symptomResponseModel
      .findById(responseId)
      .populate('symptomFormId')
      .exec();

    if (!response) {
      throw new NotFoundException('Response not found');
    }

    const patient = await this.userModel.findById(response.patientId).exec();
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const context = this.buildValidationContext(response, patient, patientContext);

    const prompt = `
You are an experienced medical coordinator writing validation notes for patient symptom submissions.

PATIENT CONTEXT:
- Name: ${patient.firstName} ${patient.lastName}
- Department: ${patient.assignedDepartment || department}
- Email: ${patient.email || 'Not specified'}

SYMPTOM SUBMISSION:
- Date: ${response.createdAt?.toLocaleDateString() || 'N/A'}
- Vitals: ${JSON.stringify(response.vitals, null, 2)}

SYMPTOM ANSWERS:
${response.answers.map((a) => `- ${a.questionId}: ${JSON.stringify(a.value)}`).join('\n')}

${patientContext ? `ADDITIONAL CONTEXT: ${patientContext}` : ''}

TASK: Generate EXACTLY 5 professional, concise, and relevant validation note suggestions for this submission.

RULES:
1. Each suggestion must be a complete sentence of 10-30 words
2. Be specific to the symptoms presented
3. Include relevant clinical recommendations
4. Use a professional yet accessible tone
5. If abnormal vitals are detected, suggest specific actions

RESPONSE FORMAT: Return ONLY a JSON array of 5 strings, no markdown, no backticks.

Example format: ["Suggestion 1", "Suggestion 2", "Suggestion 3", "Suggestion 4", "Suggestion 5"]
`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: 'system', content: 'You are a professional medical assistant generating validation suggestions.' },
          { role: 'user', content: prompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        if (Array.isArray(suggestions) && suggestions.length === 5) {
          return suggestions;
        }
      }

      return this.getFallbackSuggestions();
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }

  async getRealTimeSuggestions(
    partialNote: string,
    responseId: string,
    department: string,
  ): Promise<{ completions: string[]; medicalTerms: string[] }> {
    if (!partialNote || partialNote.length < 3) {
      return { completions: [], medicalTerms: [] };
    }

    if (responseId && isValidObjectId(responseId)) {
      const response = await this.symptomResponseModel.findById(responseId).exec();
      if (!response) {
        console.warn('[Suggestions] responseId not found:', responseId);
      }
    }

    const medicalTermsByDepartment: Record<string, string[]> = {
      Cardiology: ['tachycardia', 'bradycardia', 'hypertension', 'hypotension', 'palpitations', 'edema', 'syncope', 'arrhythmia'],
      Neurology: ['headache', 'dizziness', 'paresthesia', 'ataxia', 'aphasia', 'tremors', 'epilepsy', 'migraine'],
      Pediatrics: ['fever', 'dehydration', 'skin rash', 'seizures', 'cough', 'vomiting', 'diarrhea'],
      Oncology: ['neutropenia', 'anemia', 'thrombocytopenia', 'mucositis', 'alopecia', 'cachexia', 'neuropathic pain'],
      Surgery: ['suppuration', 'dehiscence', 'hematoma', 'seroma', 'nosocomial infection', 'wound healing'],
      Orthopedics: ['immobilization', 'mobilization', 'rehabilitation', 'edema', 'hematoma', 'mechanical pain'],
      General: ['pain', 'fever', 'infection', 'inflammation', 'treatment', 'medication', 'follow-up', 'observation'],
    };

    const defaultTerms = ['pain', 'fever', 'infection', 'inflammation', 'treatment', 'medication', 'follow-up', 'observation'];
    const departmentTerms = medicalTermsByDepartment[department] || defaultTerms;

    const lastWord = partialNote.trim().split(' ').pop()?.toLowerCase() || '';
    const matchingTerms = lastWord.length >= 2
      ? departmentTerms.filter(term => term.toLowerCase().startsWith(lastWord))
      : [];

    let completions: string[] = [];

    if (partialNote.length >= 5) {
      const completionPrompt = `Complete this medical phrase (return ONLY 3 possible continuations separated by |, do not repeat the beginning):
"${partialNote}"
Format: continuation1|continuation2|continuation3`;

      try {
        const completion = await this.client.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.5,
          max_tokens: 100,
          messages: [
            { role: 'system', content: 'Medical assistant. Reply only with short phrase continuations separated by |.' },
            { role: 'user', content: completionPrompt },
          ],
        });

        const raw = completion.choices[0]?.message?.content?.trim() || '';
        console.log('[Suggestions] Raw completions:', raw);
        completions = raw.split('|').map(s => s.trim()).filter(s => s.length > 0).slice(0, 3);
      } catch (error) {
        console.error('Error generating completions:', error);
      }
    }

    return {
      completions,
      medicalTerms: matchingTerms.slice(0, 5),
    };
  }

  private buildValidationContext(
    response: SymptomResponseDocument,
    patient: UserDocument,
    additionalContext?: string,
  ): string {
    const abnormalVitals: string[] = [];

    if (response.vitals) {
      if (response.vitals.heartRate && (response.vitals.heartRate > 100 || response.vitals.heartRate < 60)) {
        abnormalVitals.push(`heart rate ${response.vitals.heartRate} bpm (abnormal)`);
      }
      if (response.vitals.temperature && response.vitals.temperature > 37.5) {
        abnormalVitals.push(`temperature ${response.vitals.temperature}°C (fever)`);
      }
      if (response.vitals.bloodPressure) {
        const [systolic, diastolic] = response.vitals.bloodPressure.split('/');
        if (parseInt(systolic) > 140 || parseInt(diastolic) > 90) {
          abnormalVitals.push(`blood pressure ${response.vitals.bloodPressure} (hypertension)`);
        }
      }
    }

    return `
Detected anomalies: ${abnormalVitals.length > 0 ? abnormalVitals.join(', ') : 'No major anomalies detected'}
Validation status: ${response.validated ? 'Already validated' : 'Pending validation'}
${additionalContext ? `Additional note: ${additionalContext}` : ''}
    `;
  }

  private getFallbackSuggestions(): string[] {
    return [
      "Symptoms consistent with known pathology, favorable progression. Continue home monitoring.",
      "Clinical presentation coherent. No signs of severity. Standard follow-up recommended.",
      "Patient clinically stable. Follow the established monitoring protocol.",
      "Symptoms controlled by current treatment. Maintain current management plan.",
      "No warning signs detected. Schedule a follow-up consultation within 7 days.",
    ];
  }
}