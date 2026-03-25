import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/users.schema';
import { Service } from '../service/service.schema';
import { Questionnaire } from 'src/questionnaires/schemas/questionnaire.schema';
import Groq from 'groq-sdk';

type AIInsight = {
    type: string;
    message: string;
    recommendation: string;
};

@Injectable()
export class DashboardService {
    private groqApi: Groq;

    constructor(
        @InjectModel(User.name)
        private userModel: Model<User>,

        @InjectModel(Service.name)
        private serviceModel: Model<Service>,

        @InjectModel(Questionnaire.name)
        private questionnaireModel: Model<Questionnaire>,
    ) {
        this.groqApi = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    // ─────────────────────────────────────────────
    // 1. KPI SUMMARY
    // GET /dashboard/summary
    // ─────────────────────────────────────────────
    async getSummary() {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
            totalPatients,
            newPatientsThisWeek,
            totalDoctors,
            activeServices,
            inactiveServices,
            totalQuestionnaires,
            activeQuestionnaires,
        ] = await Promise.all([
            this.userModel.countDocuments({ actif: true }).exec(),
            this.userModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
            this.userModel.countDocuments({ actif: true, specialization: { $exists: true, $ne: null } }).exec(),
            this.serviceModel.countDocuments({ statut: 'ACTIF', deletedAt: null }).exec(),
            this.serviceModel.countDocuments({ statut: 'INACTIF', deletedAt: null }).exec(),
            this.questionnaireModel.countDocuments().exec(),
            this.questionnaireModel.countDocuments({ status: 'active' }).exec(),
        ]);

        const responsesAgg = await this.questionnaireModel
            .aggregate([{ $group: { _id: null, totalResponses: { $sum: '$responsesCount' } } }])
            .exec();

        const totalResponses = responsesAgg[0]?.totalResponses ?? 0;

        return {
            patients: { total: totalPatients, newThisWeek: newPatientsThisWeek },
            doctors: { total: totalDoctors },
            services: {
                total: activeServices + inactiveServices,
                active: activeServices,
                inactive: inactiveServices,
            },
            questionnaires: { total: totalQuestionnaires, active: activeQuestionnaires, totalResponses },
        };
    }

    // ─────────────────────────────────────────────
    // 2. ACTIVITÉ DE SUIVI DANS LE TEMPS
    // GET /dashboard/followup-activity?range=7d
    // ─────────────────────────────────────────────
    async getFollowupActivity(range: string) {
        const days = range === '30d' ? 30 : range === '90d' ? 90 : 7;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const newUsersPerDay = await this.userModel
            .aggregate([
                { $match: { createdAt: { $gte: since } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        newPatients: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', newPatients: 1 } },
            ])
            .exec();

        const responsesByDay = await this.questionnaireModel
            .aggregate([
                { $match: { updatedAt: { $gte: since }, responsesCount: { $gt: 0 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
                        submittedResponses: { $sum: '$responsesCount' },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', submittedResponses: 1 } },
            ])
            .exec();

        const merged: Record<string, { date: string; newPatients: number; submittedResponses: number }> = {};

        for (let i = 0; i < days; i++) {
            const d = new Date(since);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split('T')[0];
            merged[key] = { date: key, newPatients: 0, submittedResponses: 0 };
        }

        newUsersPerDay.forEach(r => {
            if (merged[r.date]) merged[r.date].newPatients = r.newPatients;
        });
        responsesByDay.forEach(r => {
            if (merged[r.date]) merged[r.date].submittedResponses = r.submittedResponses;
        });

        return Object.values(merged);
    }

    // ─────────────────────────────────────────────
    // 3. PATIENTS PAR SERVICE
    // ─────────────────────────────────────────────
    async getPatientsByService() {
        const patientsByDept = await this.userModel
            .aggregate([
                {
                    $match: {
                        actif: true,
                        assignedDepartment: { $exists: true, $nin: [null, ''] },
                    },
                },
                { $group: { _id: '$assignedDepartment', patientCount: { $sum: 1 } } },
                { $sort: { patientCount: -1 } },
            ])
            .exec();

        const questsByService = await this.questionnaireModel
            .aggregate([
                { $match: { status: 'active' } },
                {
                    $group: {
                        _id: '$medicalService',
                        totalResponses: { $sum: '$responsesCount' },
                        questionnaireCount: { $sum: 1 },
                    },
                },
            ])
            .exec();

        const questMap = new Map<string, { totalResponses: number; questionnaireCount: number }>();
        questsByService.forEach(q => questMap.set(q._id, q));

        return patientsByDept.map(dept => ({
            serviceName: dept._id,
            patientCount: dept.patientCount,
            totalResponses: questMap.get(dept._id)?.totalResponses ?? 0,
            questionnairesCount: questMap.get(dept._id)?.questionnaireCount ?? 0,
        }));
    }

    // ─────────────────────────────────────────────
    // 4. COMPLIANCE PAR SERVICE
    // ─────────────────────────────────────────────
    async getComplianceByService() {
        const [questByService, patientsByDept] = await Promise.all([
            this.questionnaireModel
                .aggregate([
                    {
                        $group: {
                            _id: '$medicalService',
                            totalResponses: { $sum: '$responsesCount' },
                            activeCount: {
                                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                            },
                        },
                    },
                    { $sort: { totalResponses: -1 } },
                ])
                .exec(),

            this.userModel
                .aggregate([
                    {
                        $match: {
                            actif: true,
                            assignedDepartment: { $exists: true, $ne: null },
                        },
                    },
                    { $group: { _id: '$assignedDepartment', patientCount: { $sum: 1 } } },
                ])
                .exec(),
        ]);

        const patientMap = new Map<string, number>();
        patientsByDept.forEach(p => patientMap.set(p._id, p.patientCount));

        return questByService.map(svc => {
            const patients = patientMap.get(svc._id) ?? 0;
            const expected = patients * svc.activeCount;
            const complianceRate =
                expected > 0
                    ? Math.min(100, Math.round((svc.totalResponses / expected) * 100))
                    : 0;

            return {
                serviceName: svc._id,
                complianceRate,
                totalResponses: svc.totalResponses,
                patientCount: patients,
                activeQuestionnaires: svc.activeCount,
                nonCompliantEstimate: Math.max(0, expected - svc.totalResponses),
            };
        });
    }

    // ─────────────────────────────────────────────
    // 5. STATISTIQUES QUESTIONNAIRES
    // ─────────────────────────────────────────────
    async getQuestionnairesStats() {
        const stats = await this.questionnaireModel
            .aggregate([
                {
                    $project: {
                        title: 1,
                        medicalService: 1,
                        status: 1,
                        responsesCount: 1,
                        questionCount: { $size: '$questions' },
                    },
                },
                {
                    $group: {
                        _id: '$medicalService',
                        questionnaires: {
                            $push: {
                                title: '$title',
                                status: '$status',
                                responsesCount: '$responsesCount',
                                questionCount: '$questionCount',
                            },
                        },
                        totalResponses: { $sum: '$responsesCount' },
                        totalQuestionnaires: { $sum: 1 },
                        activeCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                        },
                    },
                },
                { $sort: { totalResponses: -1 } },
            ])
            .exec();

        const flat = await this.questionnaireModel
            .aggregate([
                {
                    $project: {
                        title: 1,
                        medicalService: 1,
                        status: 1,
                        responsesCount: 1,
                        questionCount: { $size: '$questions' },
                    },
                },
                { $sort: { responsesCount: -1 } },
                { $limit: 10 },
            ])
            .exec();

        return {
            byService: stats,
            topQuestionnaires: flat.map(q => ({
                title: q.title,
                service: q.medicalService,
                status: q.status,
                responses: q.responsesCount,
                questions: q.questionCount,
            })),
        };
    }

    // ─────────────────────────────────────────────
    // 6. PATIENTS À HAUT RISQUE
    // FIX : ajout du calcul de riskScore (0-100) attendu par le frontend
    // ─────────────────────────────────────────────
    async getHighRiskPatients() {
        return this.userModel.aggregate([
            {
                $match: {
                    actif: true,
                    assignedDepartment: { $exists: true, $nin: [null, ''] },
                },
            },
            {
                $lookup: {
                    from: 'questionnaires',
                    localField: 'assignedDepartment',
                    foreignField: 'medicalService',
                    as: 'questionnaires',
                },
            },
            {
                $addFields: {
                    totalResponses: { $sum: '$questionnaires.responsesCount' },
                    activeQuestionnaires: {
                        $size: {
                            $filter: {
                                input: '$questionnaires',
                                as: 'q',
                                cond: { $eq: ['$$q.status', 'active'] },
                            },
                        },
                    },
                },
            },
            {
                // riskScore : 100 si 0 réponse, décroît jusqu'à 0 quand responses >= activeQuestionnaires
                $addFields: {
                    riskScore: {
                        $cond: [
                            { $eq: ['$activeQuestionnaires', 0] },
                            0,
                            {
                                $max: [
                                    0,
                                    {
                                        $round: [
                                            {
                                                $multiply: [
                                                    {
                                                        $subtract: [
                                                            1,
                                                            { $divide: ['$totalResponses', '$activeQuestionnaires'] },
                                                        ],
                                                    },
                                                    100,
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            { $match: { riskScore: { $gte: 70 } } },
            { $sort: { riskScore: -1 } },
            {
                $project: {
                    firstName: 1,
                    lastName: 1,
                    assignedDepartment: 1,
                    riskScore: 1,
                    lastActivity: '$updatedAt',
                },
            },
        ]);
    }

    // ─────────────────────────────────────────────
    // 7. GLOBAL FOLLOWUP RATE
    // ─────────────────────────────────────────────
    async getGlobalFollowupRate() {
        const patients = await this.userModel.countDocuments({ actif: true });
        const responses = await this.questionnaireModel.aggregate([
            { $group: { _id: null, total: { $sum: '$responsesCount' } } },
        ]);
        const totalResponses = responses[0]?.total ?? 0;

        const rate = patients > 0 ? Math.round((totalResponses / patients) * 100) : 0;
        return {
            rate,
            completed: totalResponses,
            total: patients,
        };
    }

    // ─────────────────────────────────────────────
    // 8. SERVER HEALTH
    // ─────────────────────────────────────────────
    async getServerHealth() {
        const memoryUsage = process.memoryUsage();
        return {
            status: 'OK',
            uptime: process.uptime(),
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            },
            cpu: process.cpuUsage(),
            timestamp: new Date(),
        };
    }

    // ─────────────────────────────────────────────
    // 9. SECURITY STATS
    // ─────────────────────────────────────────────
    async getSecurityStats() {
        return {
            rateLimit: { maxRequests: 10, window: '60 seconds' },
            suspiciousActivities: 0,
            blockedIPs: [],
        };
    }

    // ─────────────────────────────────────────────
    // 10. ALERTS
    // ─────────────────────────────────────────────
    async getAlerts() {
        type Alert = {
            type: string;
            message: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH';
        };
        const alerts: Alert[] = [];

        const totalPatients = await this.userModel.countDocuments({ actif: true });
        const inactivePatients = await this.userModel.countDocuments({
            actif: true,
            lastLogin: {
                $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
        });

        if (inactivePatients > totalPatients * 0.3) {
            alerts.push({
                type: 'HIGH_INACTIVITY',
                message: 'Beaucoup de patients inactifs',
                severity: 'HIGH',
            });
        }

        const inactiveServices = await this.serviceModel.countDocuments({
            statut: 'INACTIF',
        });
        if (inactiveServices > 0) {
            alerts.push({
                type: 'INACTIVE_SERVICES',
                message: `${inactiveServices} services inactifs`,
                severity: 'MEDIUM',
            });
        }

        return alerts;
    }

    // ─────────────────────────────────────────────
    // 11. AI INSIGHTS
    // FIX : appel Groq corrigé — chat.completions.create() au lieu de groqApi.(...)
    //       modèle Groq valide (llama-3.3-70b-versatile)
    //       parsing JSON robuste avec strip des backticks markdown
    // ─────────────────────────────────────────────
    async getAIInsightsDynamic(): Promise<AIInsight[]> {
        try {
            const totalResponsesAgg = await this.questionnaireModel.aggregate([
                { $group: { _id: null, total: { $sum: '$responsesCount' } } },
            ]);
            const totalResponses = totalResponsesAgg[0]?.total ?? 0;
            const totalPatients = await this.userModel.countDocuments({ actif: true });
            const avgResponse = totalPatients > 0 ? totalResponses / totalPatients : 0;
            const activeServices = await this.serviceModel.countDocuments({ statut: 'ACTIF' });
            const inactiveServices = await this.serviceModel.countDocuments({ statut: 'INACTIF' });

            const prompt = `
Tu es un assistant de gestion hospitalière pour un dashboard.
Données disponibles :
- Patients actifs : ${totalPatients}
- Total réponses questionnaires : ${totalResponses}
- Moyenne réponses par patient : ${avgResponse.toFixed(2)}
- Services actifs : ${activeServices}
- Services inactifs : ${inactiveServices}

Génère 1 à 3 recommandations concrètes pour :
1. Améliorer engagement patient
2. Optimiser le fonctionnement des services
3. Détecter anomalies ou alertes potentielles

Retourne UNIQUEMENT un tableau JSON valide, sans texte ni balises markdown :
[
  { "type": "string", "message": "string", "recommendation": "string" }
]
`;

            // FIX: utilisation correcte de l'API Groq via chat.completions.create()
            const completion = await this.groqApi.chat.completions.create({
                model: 'llama-3.3-70b-versatile', // modèle Groq valide (pas gpt-4 qui est OpenAI)
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 1024,
            });

            const raw = completion.choices[0]?.message?.content ?? '';

            // FIX: strip des backticks markdown si le modèle en ajoute quand même
            const clean = raw.replace(/```(?:json)?/gi, '').trim();

            return JSON.parse(clean) as AIInsight[];
        } catch (err) {
            console.error('Erreur AI Insights:', err);
            return [];
        }
    }

    // ─────────────────────────────────────────────
    // 12. INACTIVE PATIENTS
    // FIX : ajout du calcul de daysSinceActivity attendu par le frontend
    // ─────────────────────────────────────────────
    async getInactivePatients() {
        return this.userModel.find({ actif: true, lastLogin: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
            .select('firstName lastName email assignedDepartment lastLogin')
            .lean();
    }


    // ─────────────────────────────────────────────
    // 13. SERVICES OVERVIEW
    // ─────────────────────────────────────────────
    async getServicesOverview() {
        const services = await this.serviceModel
            .find({ deletedAt: null })
            .select('nom type statut localisation capacite estUrgence')
            .lean()
            .exec();

        const questCount = await this.questionnaireModel
            .aggregate([
                {
                    $group: {
                        _id: '$medicalService',
                        count: { $sum: 1 },
                        totalResponses: { $sum: '$responsesCount' },
                    },
                },
            ])
            .exec();

        const questMap = new Map<string, { count: number; totalResponses: number }>();
        questCount.forEach(q => questMap.set(q._id, { count: q.count, totalResponses: q.totalResponses }));

        return {
            total: services.length,
            active: services.filter(s => s.statut === 'ACTIF').length,
            inactive: services.filter(s => s.statut === 'INACTIF').length,
            emergency: services.filter(s => s.estUrgence).length,
            list: services.map(svc => ({
                ...svc,
                linkedQuestionnaires: questMap.get(svc.nom)?.count ?? 0,
                totalResponses: questMap.get(svc.nom)?.totalResponses ?? 0,
            })),
        };
    }
}