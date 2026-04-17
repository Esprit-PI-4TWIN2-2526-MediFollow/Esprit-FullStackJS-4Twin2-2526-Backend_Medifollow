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
  private readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://ml-service-vkpy.onrender.com';

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
      this.httpService.post(`${this.ML_SERVICE_URL}/analysis/generate`, {
        patient_id: patientId,
        patient_name: patientFullName,
        answers: formAnswers,
      }),
    );

    const mlResult = response.data;
    console.log(`🤖 [ML] Réponse du service ML reçue: ${JSON.stringify(mlResult)}`);

    const extractRecommendations = (text: string): string | null => {
      const marker = '**Recommendations for the Physician:**';
      const index = text.indexOf(marker);
      if (index === -1) return null;
      return text.substring(index + marker.length).replace(/\\n/g, '\n').trim();
    };

    const cleanAnalysis = (text: string): string => {
      const marker = '**Recommendations for the Physician:**';
      const index = text.indexOf(marker);
      return index === -1 ? text : text.substring(0, index).trim();
    };

    const saved = await this.analysisModel.create({
      patient: patient._id,
      analysis: cleanAnalysis(mlResult.analysis),
      key_findings: mlResult.key_findings ?? [],
      gravity: mlResult.gravity?.toLowerCase() ?? 'low',
      confidence: mlResult.confidence ?? 0,
      answers: formAnswers,
      recommendations: extractRecommendations(mlResult.analysis),
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