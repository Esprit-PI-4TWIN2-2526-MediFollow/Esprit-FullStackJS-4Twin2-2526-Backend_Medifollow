// src/ai-analysis/analysis.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '../users/users.service';
import { Analysis } from './schemas/analysis.schema';

@Injectable()
export class AnalysisService {
  private readonly ML_SERVICE_URL = process.env.GRAVITY_SERVICE_URL || 'https://gravity-service.onrender.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    @InjectModel(Analysis.name)
    private readonly analysisModel: Model<Analysis>,
  ) {}

 // src/ai-analysis/analysis.service.ts

async generateFromFormAnswers(
  patientId: string,
  formAnswers: Array<{ question: string; answer: any }>,
): Promise<Analysis | null> {
  try {
    console.log(`🤖 [ML] Démarrage de l'analyse IA pour patientId=${patientId}`);
    const patient = await this.usersService.findOne(patientId);
    if (!patient) {
      console.warn(`🤖 [ML] Patient introuvable pour l'analyse IA: ${patientId}`);
      return null;
    }

    const patientFullName = `${patient.firstName} ${patient.lastName}`;
    console.log(`🤖 [ML] Patient trouvé: ${patientFullName}`);
    console.log(`🤖 [ML] Envoi des réponses au service ML: ${JSON.stringify(formAnswers)}`);

    const response = await firstValueFrom(
      this.httpService.post(`${this.ML_SERVICE_URL}/predict-gravity`, {
        patient_id: patientId,
        patient_name: patientFullName,
        answers: formAnswers,
      }),
    );

    const mlResult = response.data;
    console.log(`🤖 [ML] Réponse du service ML reçue: ${JSON.stringify(mlResult)}`);

    // Generate analysis text from gravity result
    const generateAnalysisText = (result: any): string => {
      const painLevel = result.features?.pain_level || 'unknown';
      const temp = result.features?.temperature || 'unknown';
      const gravityLevel = result.gravity || 'unknown';
      
      return `Patient ${patientFullName} assessment completed. Gravity level: ${gravityLevel} (confidence: ${result.confidence}%). ` +
             `Pain level: ${painLevel}/10, Temperature: ${temp}°C. ` +
             `Based on the symptoms analysis, the patient requires ${gravityLevel === 'high' || gravityLevel === 'critical' ? 'immediate' : 'routine'} medical attention.`;
    };

    // Extract key findings from features
    const extractKeyFindings = (result: any): string[] => {
      const findings: string[] = [];
      const features = result.features || {};
      
      if (features.severe_pain === 1) findings.push(`Severe pain detected (${features.pain_level}/10)`);
      if (features.fever === 1) findings.push(`Fever present (${features.temperature}°C)`);
      if (features.hypoxemia === 1) findings.push('Low oxygen saturation detected');
      if (features.tachycardia === 1) findings.push('Elevated heart rate');
      if (features.hypotension === 1) findings.push('Low blood pressure');
      if (features.shortness_breath_score > 0) findings.push('Shortness of breath reported');
      
      if (findings.length === 0) {
        findings.push('No critical findings detected');
      }
      
      return findings;
    };

    const extractRecommendations = (gravity: string): string => {
      switch (gravity?.toLowerCase()) {
        case 'critical':
          return 'URGENT: Immediate medical evaluation required. Consider emergency department visit.';
        case 'high':
          return 'Contact physician within 24 hours. Close monitoring recommended.';
        case 'medium':
          return 'Schedule follow-up appointment within 48-72 hours. Monitor symptoms.';
        case 'low':
        default:
          return 'Continue routine monitoring. Contact if symptoms worsen.';
      }
    };

    const saved = await this.analysisModel.create({
      patient: patient._id,
      analysis: generateAnalysisText(mlResult),
      key_findings: extractKeyFindings(mlResult),
      gravity: mlResult.gravity?.toLowerCase() ?? 'low',
      confidence: (mlResult.confidence ?? 0) / 100, // Convert percentage to decimal
      answers: formAnswers,
      recommendations: extractRecommendations(mlResult.gravity),
    });

    return saved;
  } catch (error: any) {
    // On ne bloque pas la soumission du formulaire si le ML échoue
    console.error('⚠️ ML Analysis failed (non-blocking):', error.message);
    return null;
  }
}

  // Historique des analyses d'un patient
  async getAnalysesByPatient(patientId: string): Promise<Analysis[]> {
    return this.analysisModel
      .find({ patient: patientId })
      .sort({ createdAt: -1 })
      .populate('patient', 'firstName lastName email')
      .exec();
  }

  // Détail d'une analyse
  async getAnalysisById(id: string): Promise<Analysis> {
    const analysis = await this.analysisModel
      .findById(id)
      .populate('patient', 'firstName lastName email')
      .exec();

    if (!analysis) throw new NotFoundException('Analyse introuvable');
    return analysis;
  }

  // Dernière analyse d'un patient
  async getLatestByPatient(patientId: string): Promise<Analysis | null> {
    return this.analysisModel
      .findOne({ patient: patientId })
      .sort({ createdAt: -1 })
      .populate('patient', 'firstName lastName email')
      .exec();
  }
}