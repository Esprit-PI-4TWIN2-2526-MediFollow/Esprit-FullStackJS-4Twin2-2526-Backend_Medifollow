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

    // Préparer le contexte pour l'IA
    const context = this.buildValidationContext(response, patient, patientContext);

    const prompt = `
Vous êtes un coordinateur médical expérimenté qui doit rédiger des notes de validation pour les soumissions de symptômes des patients.

CONTEXTE PATIENT:
- Nom: ${patient.firstName} ${patient.lastName}
- Département: ${patient.assignedDepartment || department}
- Email: ${patient.email || 'Non spécifié'}

SOUMISSION DES SYMPTÔMES:
- Date: ${response.createdAt?.toLocaleDateString() || 'N/A'}
- Vitals: ${JSON.stringify(response.vitals, null, 2)}

RÉPONSES AUX SYMPTÔMES:
${response.answers.map((a, i) => `- ${a.questionId}: ${JSON.stringify(a.value)}`).join('\n')}

${patientContext ? `CONTEXTE SUPPLÉMENTAIRE: ${patientContext}` : ''}

TÂCHE: Générez EXACTEMENT 5 suggestions de notes de validation professionnelles, concises et pertinentes pour cette soumission.

RÈGLES:
1. Chaque suggestion doit être une phrase complète de 10-30 mots
2. Être spécifique aux symptômes présentés
3. Inclure des recommandations cliniques pertinentes
4. Utiliser un ton professionnel mais accessible
5. Si des vitaux anormaux sont détectés, suggérer des actions spécifiques

FORMAT DE RÉPONSE: Retournez UNIQUEMENT un tableau JSON de 5 strings, sans markdown, sans backticks.

Exemple de format: ["Suggestion 1", "Suggestion 2", "Suggestion 3", "Suggestion 4", "Suggestion 5"]
`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: 'system', content: 'Vous êtes un assistant médical professionnel générant des suggestions de validation.' },
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

 // suggestions.service.ts
async getRealTimeSuggestions(
    partialNote: string,
    responseId: string,
    department: string,
): Promise<{ completions: string[]; medicalTerms: string[] }> {
    if (!partialNote || partialNote.length < 3) {
        return { completions: [], medicalTerms: [] };
    }

    // ← Ne plus bloquer si responseId invalide
    if (responseId && isValidObjectId(responseId)) {
        const response = await this.symptomResponseModel.findById(responseId).exec();
        if (!response) {
            console.warn('[Suggestions] responseId non trouvé:', responseId);
            // Continuer quand même avec les termes médicaux
        }
    }

    const medicalTermsByDepartment: Record<string, string[]> = {
        Cardiology: ['tachycardie', 'bradycardie', 'hypertension', 'hypotension', 'palpitations', 'œdème', 'syncope', 'arythmie'],
        Neurology: ['céphalée', 'vertiges', 'paresthésie', 'ataxie', 'aphasie', 'tremblements', 'épilepsie', 'migraine'],
        Pediatrics: ['fièvre', 'déshydratation', 'éruption cutanée', 'convulsions', 'toux', 'vomissements', 'diarrhée'],
        Oncology: ['neutropénie', 'anémie', 'thrombocytopénie', 'mucite', 'alopécie', 'cachexie', 'douleur neuropathique'],
        Surgery: ['suppuration', 'déhiscence', 'hématome', 'sérome', 'infection nosocomiale', 'cicatrisation'],
        Orthopedics: ['immobilisation', 'mobilisation', 'rééducation', 'œdème', 'hématome', 'douleur mécanique'],
        General: ['douleur', 'fièvre', 'infection', 'inflammation', 'traitement', 'médicament', 'suivi', 'observation'],
    };

    const defaultTerms = ['douleur', 'fièvre', 'infection', 'inflammation', 'traitement', 'médicament', 'suivi', 'observation'];
    const departmentTerms = medicalTermsByDepartment[department] || defaultTerms;

    const lastWord = partialNote.trim().split(' ').pop()?.toLowerCase() || '';
    const matchingTerms = lastWord.length >= 2
        ? departmentTerms.filter(term => term.toLowerCase().startsWith(lastWord))
        : [];

    let completions: string[] = [];

    if (partialNote.length >= 5) {
        const completionPrompt = `Complétez cette phrase médicale (retournez UNIQUEMENT 3 suites possibles séparées par |, sans répéter le début):
"${partialNote}"
Format: suite1|suite2|suite3`;

        try {
            const completion = await this.client.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.5,
                max_tokens: 100,
                messages: [
                    { role: 'system', content: 'Assistant médical. Réponds uniquement avec des suites de phrases courtes séparées par |.' },
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
        abnormalVitals.push(`fréquence cardiaque ${response.vitals.heartRate} bpm (anormal)`);
      }
      if (response.vitals.temperature && response.vitals.temperature > 37.5) {
        abnormalVitals.push(`température ${response.vitals.temperature}°C (fièvre)`);
      }
      if (response.vitals.bloodPressure) {
        const [systolic, diastolic] = response.vitals.bloodPressure.split('/');
        if (parseInt(systolic) > 140 || parseInt(diastolic) > 90) {
          abnormalVitals.push(`tension artérielle ${response.vitals.bloodPressure} (hypertension)`);
        }
      }
    }

    return `
Anomalies détectées: ${abnormalVitals.length > 0 ? abnormalVitals.join(', ') : 'Aucune anomalie majeure'}
Statut validation: ${response.validated ? 'Déjà validé' : 'En attente de validation'}
${additionalContext ? `Note additionnelle: ${additionalContext}` : ''}
    `;
  }

  private getFallbackSuggestions(): string[] {
    return [
      "Symptômes typiques de la pathologie, évolution favorable. Continuer surveillance à domicile.",
      "Présentation clinique cohérente. Pas de signes de gravité. Suivi standard recommandé.",
      "Patient stable cliniquement. Respecter le protocole de suivi établi.",
      "Symptômes contrôlés par traitement actuel. Maintenir la prise en charge actuelle.",
      "Absence de signes d'alarme. Programmer consultation de contrôle dans 7 jours.",
    ];
  }
}