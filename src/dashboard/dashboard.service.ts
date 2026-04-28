import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/users.schema';
import { Service } from '../service/service.schema';
import { Questionnaire } from 'src/questionnaires/schemas/questionnaire.schema';
import { Symptom } from 'src/symptoms/schemas/symptom.schema';
import { SymptomResponse } from 'src/symptoms/schemas/symptom-response.schema';
import { Role } from 'src/role/schemas/role.schema';
import Groq from 'groq-sdk';
import { QuestionnaireResponse } from 'src/questionnaires/schemas/questionnaire-response.schema';

type AIInsight = {
    type: string;
    message: string;
    recommendation: string;
};

@Injectable()
export class DashboardService {
    private groqApi: Groq;

    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Service.name) private serviceModel: Model<Service>,
        @InjectModel(Questionnaire.name) private questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireResponse.name) private questionnaireResponseModel: Model<QuestionnaireResponse>, // ✅ AJOUT
        @InjectModel(Symptom.name) private symptomModel: Model<Symptom>,
        @InjectModel(SymptomResponse.name) private symptomResponseModel: Model<SymptomResponse>,
        @InjectModel(Role.name) private roleModel: Model<Role>,
    ) {
        this.groqApi = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
async getSummary() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const allRoles = await this.roleModel.find().select('_id name').lean().exec();

    const getRoleFilter = (targetName: string) => {
        const matched = allRoles.filter(
            r => r.name.trim().toLowerCase() === targetName.trim().toLowerCase()
        );

        const ids = matched.map(r => new Types.ObjectId(r._id.toString()));
        const names = matched.map(r => r.name);

        return {
            $or: [
                { role: { $in: ids } },
                { role: { $in: names } },
                { role: { $regex: `^${targetName}$`, $options: 'i' } },
            ],
        };
    };

    const patientFilter = getRoleFilter('patient');
    const doctorFilter = getRoleFilter('doctor');
    const nurseFilter = getRoleFilter('nurse');
    const coordinatorFilter = getRoleFilter('coordinator');

    const [
        totalPatients,
        newPatientsThisWeek,
        totalDoctors,
        totalNurses,
        totalCoordinators,
        totalActiveUsers,
        inactiveUsers7d,
        activeServices,
        inactiveServices,
        emergencyServices,
        totalQuestionnaires,
        activeQuestionnaires,
        archivedQuestionnaires,
        totalSymptomForms,
        activeSymptomForms,
        pendingValidations,
        completedToday,
        totalSymptomResponses // ✅ FIX ICI
    ] = await Promise.all([
        this.userModel.countDocuments({ $or: patientFilter.$or, actif: true }),
        this.userModel.countDocuments({ $or: patientFilter.$or, createdAt: { $gte: weekAgo } }),
        this.userModel.countDocuments({ $or: doctorFilter.$or, actif: true }),
        this.userModel.countDocuments({ $or: nurseFilter.$or, actif: true }),
        this.userModel.countDocuments({ $or: coordinatorFilter.$or, actif: true }),
        this.userModel.countDocuments({ actif: true }),
        this.userModel.countDocuments({ actif: true, lastLogin: { $lt: sevenDaysAgo } }),
        this.serviceModel.countDocuments({ statut: 'ACTIF', deletedAt: null }),
        this.serviceModel.countDocuments({ statut: 'INACTIF', deletedAt: null }),
        this.serviceModel.countDocuments({ estUrgence: true, deletedAt: null }),
        this.questionnaireModel.countDocuments(),
        this.questionnaireModel.countDocuments({ status: 'active' }),
        this.questionnaireModel.countDocuments({ status: 'archived' }),
        this.symptomModel.countDocuments(),
        this.symptomModel.countDocuments({ isActive: true }),
        this.symptomResponseModel.countDocuments({ validated: false }),
        this.symptomResponseModel.countDocuments({ createdAt: { $gte: todayStart } }),
        this.symptomResponseModel.countDocuments(), // ✅ TOTAL SYMPTOM RESPONSES
    ]);

    // ─────────────────────────────────────────────
    // FOLLOWUP DATA
    // ─────────────────────────────────────────────

    const [symptomToday, questToday] = await Promise.all([
        this.symptomResponseModel.distinct('patientId', {
            createdAt: { $gte: todayStart }
        }),

        this.questionnaireResponseModel.distinct('patientId', {
            createdAt: { $gte: todayStart }
        }),
    ]);

    const respondedToday = new Set([
        ...symptomToday,
        ...questToday
    ].map(id => id?.toString()).filter(Boolean)).size;

    const [symptomEver, questEver] = await Promise.all([
        this.symptomResponseModel.distinct('patientId'),
        this.questionnaireResponseModel.distinct('patientId'),
    ]);

    const everResponded = new Set([
        ...symptomEver,
        ...questEver
    ].map(id => id?.toString()).filter(Boolean)).size;

    const totalQuestResponses = await this.questionnaireResponseModel.countDocuments();

    const todayRate =
        totalPatients > 0
            ? Math.round((respondedToday / totalPatients) * 100)
            : 0;

    const overallRate =
        totalPatients > 0
            ? Math.round((everResponded / totalPatients) * 100)
            : 0;

    return {
        users: { total: totalActiveUsers, inactive7d: inactiveUsers7d },

        patients: {
            total: totalPatients,
            newThisWeek: newPatientsThisWeek
        },

        staff: {
            doctors: { total: totalDoctors },
            nurses: { total: totalNurses },
            coordinators: { total: totalCoordinators },
        },

        services: {
            total: activeServices + inactiveServices,
            active: activeServices,
            inactive: inactiveServices,
            emergency: emergencyServices,
        },

        questionnaires: {
            total: totalQuestionnaires,
            active: activeQuestionnaires,
            archived: archivedQuestionnaires,
            totalResponses: totalQuestResponses,
        },

        symptoms: {
            totalForms: totalSymptomForms,
            activeForms: activeSymptomForms,
            pendingValidations,
            totalResponses: totalSymptomResponses, // ✅ OK FIXÉ
        },

        followup: {
            todayRate,
            overallRate,
            respondedToday,
            completedToday,
            everResponded,
            totalPatients,
        },
    };
}


    // ─────────────────────────────────────────────────────────────────────────
    // 2. FOLLOWUP ACTIVITY
    // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
async getFollowupActivity(range: string) {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 7;

    // ✅ FIX: date propre sans bug timezone
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const [newUsersPerDay, responsesByDay] = await Promise.all([
        this.userModel.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                            timezone: 'UTC'
                        }
                    },
                    newPatients: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    newPatients: 1,
                },
            },
        ]),

        this.symptomResponseModel.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                            timezone: 'UTC'
                        }
                    },
                    submittedResponses: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    submittedResponses: 1,
                },
            },
        ]),
    ]);

    const merged: Record<string, any> = {};

    for (let i = 0; i <= days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        const key = d.toISOString().split('T')[0];

        merged[key] = {
            date: key,
            newPatients: 0,
            submittedResponses: 0,
        };
    }

    newUsersPerDay.forEach(r => {
        if (merged[r.date]) merged[r.date].newPatients = r.newPatients;
    });

    responsesByDay.forEach(r => {
        if (merged[r.date]) merged[r.date].submittedResponses = r.submittedResponses;
    });

    return Object.values(merged);
}


    // ─────────────────────────────────────────────────────────────────────────
    // 3. PATIENTS BY SERVICE  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
    async getPatientsByService() {
        const patientsByDept = await this.userModel
            .aggregate([
                { $match: { actif: true, assignedDepartment: { $exists: true, $nin: [null, ''] } } },
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

    // ─────────────────────────────────────────────────────────────────────────
    // 4. COMPLIANCE BY SERVICE
    // ─────────────────────────────────────────────────────────────────────────
  async getComplianceByService() {
    const [realResponsesByService, patientsByDept, questByService] = await Promise.all([

        // 🔥 Réponses réelles par service + patients distincts
        this.questionnaireResponseModel
            .aggregate([
                {
                    $lookup: {
                        from: 'questionnaires',
                        localField: 'questionnaireId',
                        foreignField: '_id',
                        as: 'questionnaire',
                    },
                },
                { $unwind: '$questionnaire' },

                {
                    $group: {
                        _id: '$questionnaire.medicalService',
                        totalRealResponses: { $sum: 1 },
                        distinctPatients: { $addToSet: '$patientId' },
                    },
                },

                {
                    $project: {
                        _id: 1,
                        totalRealResponses: 1,
                        distinctRespondents: { $size: '$distinctPatients' },
                    },
                },
            ])
            .exec(),

        // 👥 Patients actifs par service
        this.userModel
            .aggregate([
                {
                    $match: {
                        actif: true,
                        assignedDepartment: { $exists: true, $nin: [null, ''] },
                    },
                },
                {
                    $group: {
                        _id: '$assignedDepartment',
                        patientCount: { $sum: 1 },
                    },
                },
            ])
            .exec(),

        // 📋 Questionnaires actifs
        this.questionnaireModel
            .aggregate([
                {
                    $group: {
                        _id: '$medicalService',
                        activeCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
                            },
                        },
                        totalCount: { $sum: 1 },
                    },
                },
            ])
            .exec(),
    ]);

    // ─────────────────────────────────────────────
    // MAPS
    // ─────────────────────────────────────────────
    const patientMap = new Map<string, number>();
    patientsByDept.forEach(p => patientMap.set(p._id, p.patientCount));

    const questMap = new Map<string, { activeCount: number; totalCount: number }>();
    questByService.forEach(q =>
        questMap.set(q._id, {
            activeCount: q.activeCount,
            totalCount: q.totalCount,
        }),
    );

    const responseMap = new Map<
        string,
        { totalRealResponses: number; distinctRespondents: number }
    >();

    realResponsesByService.forEach(r =>
        responseMap.set(r._id, {
            totalRealResponses: r.totalRealResponses,
            distinctRespondents: r.distinctRespondents,
        }),
    );

    // ─────────────────────────────────────────────
    // UNION DES SERVICES
    // ─────────────────────────────────────────────
    const allServices = new Set([
        ...patientMap.keys(),
        ...questMap.keys(),
        ...responseMap.keys(),
    ]);

    // ─────────────────────────────────────────────
    // CALCUL FINAL
    // ─────────────────────────────────────────────
    return Array.from(allServices).map(serviceName => {
        const patients = patientMap.get(serviceName) ?? 0;

        const activeQuestionnaires = questMap.get(serviceName)?.activeCount ?? 0;

        const totalResponses =
            responseMap.get(serviceName)?.totalRealResponses ?? 0;

        const distinctRespondents =
            responseMap.get(serviceName)?.distinctRespondents ?? 0;

        // ✅ ATTENDU RÉEL (important)
        const expected = patients * activeQuestionnaires;

        // 🔥 COMPLIANCE CORRIGÉE (vraie logique métier)
        const complianceRate =
            expected > 0
                ? Math.min(
                      100,
                      Math.round((totalResponses / expected) * 100),
                  )
                : 0;

        // 🔥 patients non couverts
        const nonCompliantEstimate = Math.max(
            0,
            patients - distinctRespondents,
        );

        return {
            serviceName,

            patientCount: patients,

            activeQuestionnaires,

            totalResponses,

            distinctRespondents,

            expected,

            complianceRate,

            nonCompliantEstimate,
        };
    }).sort((a, b) => b.complianceRate - a.complianceRate);
}

    // ─────────────────────────────────────────────────────────────────────────
    // 5. QUESTIONNAIRES STATS  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
    async getQuestionnairesStats() {
        const [stats, topQuestionnaires] = await Promise.all([

            // ✅ Groupé par service avec vrai comptage depuis questionnaireresponses
            this.questionnaireModel
                .aggregate([
                    {
                        $project: {
                            title: 1,
                            medicalService: 1,
                            status: 1,
                            questionCount: { $size: '$questions' },
                        },
                    },
                    {
                        $lookup: {
                            from: 'questionnaireresponses',
                            localField: '_id',
                            foreignField: 'questionnaireId',
                            as: 'responses',
                        },
                    },
                    {
                        $addFields: {
                            realResponsesCount: { $size: '$responses' },
                        },
                    },
                    {
                        $group: {
                            _id: '$medicalService',
                            questionnaires: {
                                $push: {
                                    title: '$title',
                                    status: '$status',
                                    responsesCount: '$realResponsesCount',
                                    questionCount: '$questionCount',
                                },
                            },
                            totalResponses: { $sum: '$realResponsesCount' },
                            totalQuestionnaires: { $sum: 1 },
                            activeCount: {
                                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                            },
                        },
                    },
                    { $sort: { totalResponses: -1 } },
                ])
                .exec(),

            // ✅ Top 10 avec vrai comptage
            this.questionnaireModel
                .aggregate([
                    {
                        $project: {
                            title: 1,
                            medicalService: 1,
                            status: 1,
                            questionCount: { $size: '$questions' },
                        },
                    },
                    {
                        $lookup: {
                            from: 'questionnaireresponses',
                            localField: '_id',
                            foreignField: 'questionnaireId',
                            as: 'responses',
                        },
                    },
                    {
                        $addFields: {
                            realResponsesCount: { $size: '$responses' },
                        },
                    },
                    { $sort: { realResponsesCount: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            title: 1,
                            medicalService: 1,
                            status: 1,
                            questionCount: 1,
                            realResponsesCount: 1,
                        },
                    },
                ])
                .exec(),
        ]);

        return {
            byService: stats,
            topQuestionnaires: topQuestionnaires.map(q => ({
                title: q.title,
                service: q.medicalService,
                status: q.status,
                responses: q.realResponsesCount,
                questions: q.questionCount,
            })),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 6. HIGH RISK PATIENTS  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
   async getHighRiskPatients() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.userModel.aggregate([

        // 🔹 patients actifs avec service
        {
            $match: {
                actif: true,
                assignedDepartment: { $exists: true, $nin: [null, ''] }
            }
        },

        // 🔹 questionnaires du service
        {
            $lookup: {
                from: 'questionnaires',
                localField: 'assignedDepartment',
                foreignField: 'medicalService',
                as: 'questionnaires',
            },
        },

        // 🔹 réponses du patient
        {
            $lookup: {
                from: 'questionnaireresponses',
                localField: '_id',
                foreignField: 'patientId',
                as: 'responses',
            },
        },

        // 🔹 garder uniquement les réponses récentes
        {
            $addFields: {
                recentResponses: {
                    $filter: {
                        input: '$responses',
                        as: 'r',
                        cond: { $gte: ['$$r.createdAt', sevenDaysAgo] }
                    }
                },

                activeQuestionnaires: {
                    $size: {
                        $filter: {
                            input: '$questionnaires',
                            as: 'q',
                            cond: { $eq: ['$$q.status', 'active'] }
                        }
                    }
                }
            }
        },

        // 🔹 dernière activité
        {
            $addFields: {
                lastResponseDate: {
                    $max: '$responses.createdAt'
                }
            }
        },

        // 🔹 calcul du risque (LOGIQUE CORRIGÉE)
        {
            $addFields: {
                riskScore: {
                    $switch: {
                        branches: [

                            // ❌ jamais répondu
                            {
                                case: { $eq: ['$lastResponseDate', null] },
                                then: 100
                            },

                            // ⚠️ inactif depuis +7 jours
                            {
                                case: {
                                    $lt: ['$lastResponseDate', sevenDaysAgo]
                                },
                                then: 80
                            },

                            // ⚠️ peu de réponses récentes
                            {
                                case: {
                                    $lt: [
                                        { $size: '$recentResponses' },
                                        1
                                    ]
                                },
                                then: 70
                            }
                        ],
                        default: 30
                    }
                }
            }
        },

        // 🔹 uniquement patients à risque
        {
            $match: {
                riskScore: { $gte: 70 }
            }
        },

        // 🔹 tri
        {
            $sort: { riskScore: -1 }
        },

        // 🔹 projection finale propre
        {
            $project: {
                firstName: 1,
                lastName: 1,
                assignedDepartment: 1,
                riskScore: 1,
                lastResponseDate: 1,
                totalResponses: { $size: '$responses' },
                recentResponsesCount: { $size: '$recentResponses' },
                activeQuestionnaires: 1
            }
        }
    ]);
}


    // ─────────────────────────────────────────────────────────────────────────
    // 7. GLOBAL FOLLOWUP RATE  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
async getGlobalFollowupRate() {

    // 🔥 filtre patient UNIQUEMENT (important)
    const allRoles = await this.roleModel.find().select('_id name').lean().exec();

    const patientRoles = allRoles.filter(
        r => r.name.trim().toLowerCase() === 'patient'
    );

    const patientRoleIds = patientRoles.map(r => r._id);

    // 1. patients actifs uniquement
    const totalPatients = await this.userModel.countDocuments({
        actif: true,
        role: { $in: patientRoleIds } // 🔥 FIX CRITIQUE
    });

    // 2. patients ayant répondu symptômes
    const symptomPatients = await this.symptomResponseModel.distinct('patientId');

    // 3. patients ayant répondu questionnaires
    const questPatients = await this.questionnaireResponseModel.distinct('patientId');

    // 4. normalisation propre
    const normalize = (ids: any[]) =>
        ids.map(id => id?.toString()).filter(Boolean);

    const respondedSet = new Set([
        ...normalize(symptomPatients),
        ...normalize(questPatients),
    ]);

    // 5. uniquement intersection réelle
    const respondedPatients = await this.userModel.countDocuments({
        _id: { $in: Array.from(respondedSet) },
        actif: true,
        role: { $in: patientRoleIds }
    });

    // 6. taux sécurisé (jamais > 100)
    const rate =
        totalPatients > 0
            ? Math.round((respondedPatients / totalPatients) * 100)
            : 0;

    return {
        rate: Math.min(100, rate),
        completed: respondedPatients,
        total: totalPatients,
    };
}





    // ─────────────────────────────────────────────────────────────────────────
    // 8. SERVER HEALTH  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // 9. SECURITY STATS  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
    async getSecurityStats() {
        return {
            rateLimit: { maxRequests: 10, window: '60 seconds' },
            suspiciousActivities: 0,
            blockedIPs: [],
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. ALERTS
    // ─────────────────────────────────────────────────────────────────────────
    async getAlerts() {
        type Alert = { type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' };
        const alerts: Alert[] = [];

        const [totalPatients, inactivePatients, inactiveServices, pendingValidations] =
            await Promise.all([
                this.userModel.countDocuments({ actif: true }),
                this.userModel.countDocuments({
                    actif: true,
                    lastLogin: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                }),
                this.serviceModel.countDocuments({ statut: 'INACTIF' }),
                // ✅ AJOUT : alerte validations en attente
                this.symptomResponseModel.countDocuments({ validated: false }),
            ]);

        if (inactivePatients > totalPatients * 0.3) {
            alerts.push({
                type: 'HIGH_INACTIVITY',
                message: `${inactivePatients} patients inactifs depuis 7 jours (${Math.round((inactivePatients / totalPatients) * 100)}%)`,
                severity: 'HIGH',
            });
        }

        if (inactiveServices > 0) {
            alerts.push({
                type: 'INACTIVE_SERVICES',
                message: `${inactiveServices} service(s) inactif(s)`,
                severity: 'MEDIUM',
            });
        }

        // ✅ AJOUT : alerte si trop de validations en attente
        if (pendingValidations > 10) {
            alerts.push({
                type: 'PENDING_VALIDATIONS',
                message: `${pendingValidations} réponses en attente de validation`,
                severity: pendingValidations > 50 ? 'HIGH' : 'MEDIUM',
            });
        }

        return alerts;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. AI INSIGHTS
    // ─────────────────────────────────────────────────────────────────────────
  async getAIInsightsDynamic(): Promise<AIInsight[]> {
  try {
    const [
      totalPatients,
      complianceByService,
      activity,
      highRiskPatients,
      pendingValidations,
      inactiveServices
    ] = await Promise.all([
      this.userModel.countDocuments({ actif: true }),

      this.getComplianceByService(), // 🔥 important

      this.getFollowupActivity('7d'), // trend

      this.getHighRiskPatients(),

      this.symptomResponseModel.countDocuments({ validated: false }),

      this.serviceModel.countDocuments({ statut: 'INACTIF' }),
    ]);

    const data = {
      totalPatients,
      pendingValidations,
      inactiveServices,
      highRiskPatients: highRiskPatients.length,

      // Top 5 worst services
      worstServices: complianceByService
        .sort((a, b) => a.complianceRate - b.complianceRate)
        .slice(0, 5),

      // trend last 7 days
      activityTrend: activity,
    };

    const prompt = `
You are a hospital data analyst for a Super Admin dashboard.

Analyze the following system data:

${JSON.stringify(data, null, 2)}

Instructions:
- Generate exactly 3 insights
- Each insight MUST be based on real numbers from the data
- Avoid generic statements
- Be precise and actionable

Return ONLY valid JSON:

[
  {
    "type": "ENGAGEMENT | SERVICE | RISK | PERFORMANCE",
    "message": "clear explanation with numbers",
    "recommendation": "specific action",
    "priority": "LOW | MEDIUM | HIGH"
  }
]
`;

    const completion = await this.groqApi.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a strict data analyst. Only return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // 🔥 très important (moins d'erreurs)
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // ✅ Parsing sécurisé
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      console.error('Invalid JSON from AI:', raw);
      return [];
    }

  } catch (err) {
    console.error('AI Insights Error:', err);
    return [];
  }
}


    // ─────────────────────────────────────────────────────────────────────────
    // 12. INACTIVE PATIENTS  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
    async getInactivePatients() {
        return this.userModel
            .find({
                actif: true,
                lastLogin: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            })
            .select('firstName lastName email assignedDepartment lastLogin')
            .lean();
    }


    // ─────────────────────────────────────────────────────────────────────────
    // 13. SERVICES OVERVIEW  (inchangé, correct)
    // ─────────────────────────────────────────────────────────────────────────
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
   async askDashboardAI(question: string): Promise<string> {
  try {
    const [summary, compliance, highRisk, activity] = await Promise.all([
      this.getSummary(),
      this.getComplianceByService(),
      this.getHighRiskPatients(),
      this.getFollowupActivity('7d'),
    ]);

    const context = {
      summary,
      compliance,
      highRisk,
      activity,
    };

    const completion = await this.groqApi.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `
You are a hospital SUPER ADMIN AI assistant.
You answer ONLY based on provided JSON data.
Be concise, analytical, and practical.
If data is missing, say "insufficient data".
          `,
        },
        {
          role: 'user',
          content: `
DATA:
${JSON.stringify(context)}

QUESTION:
${question}
          `,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content ?? 'No response';
  } catch (err) {
    console.error(err);
    return 'AI service error';
  }
}


}