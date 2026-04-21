import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { AuditLog, AuditLogDocument, AuditAction } from './schemas/audit-log.schema';
import { escapeRegex, parseBoolean } from './auditor.utils';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { User, UserDocument } from 'src/users/users.schema';

export type CreateAuditLogInput = {
  userId?: string;
  action: AuditAction;
  departement?: string;
  method: string;
  endpoint: string;
  entity?: string;
  changes?: Record<string, unknown>;
};

@Injectable()
export class AuditorService {
  private readonly logger = new Logger(AuditorService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    this.enabled = parseBoolean(this.configService.get('AUDIT_ENABLED'), true);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private parsePaging(query: QueryAuditLogsDto) {
    const pageNum = Number((query as any).page);
    const limitNum = Number((query as any).limit);

    const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;
    const limit =
      Number.isFinite(limitNum) && limitNum > 0
        ? Math.min(100, Math.floor(limitNum))
        : 20;

    return { page, limit, skip: (page - 1) * limit };
  }

  private buildBaseMatch(query: QueryAuditLogsDto) {
    const match: Record<string, any> = {};
    if (query.userId) match.userId = String(query.userId);
    if (query.action) match.action = query.action;
    if (query.entity) match.entity = query.entity;

    if (query.departement) {
      match.departement = {
        $regex: escapeRegex(String(query.departement)),
        $options: 'i',
      };
    }

    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;
    const fromOk = fromDate && !Number.isNaN(fromDate.getTime());
    const toOk = toDate && !Number.isNaN(toDate.getTime());

    if (fromOk || toOk) {
      match.timestamp = {};
      if (fromOk) match.timestamp.$gte = fromDate;
      if (toOk) match.timestamp.$lte = toDate;
    }

    return match;
  }

  enqueue(event: CreateAuditLogInput) {
    if (!this.enabled) return;

    setImmediate(() => {
      (async () => {
        let departement = event.departement;
        if (!departement && event.userId) {
          const user = await this.userModel
            .findById(event.userId)
            .select('assignedDepartment')
            .lean()
            .exec();
          departement = (user as any)?.assignedDepartment;
        }

        const doc: Omit<AuditLog, never> = {
          ...event,
          departement,
          timestamp: new Date(),
        } as any;

        await this.auditModel.create(doc as any);
      })().catch((err) =>
        this.logger.debug(`Audit log write failed: ${err?.message ?? err}`),
      );
    });
  }

  async findLogs(query: QueryAuditLogsDto) {
    const { page, limit, skip } = this.parsePaging(query);
    const baseMatch = this.buildBaseMatch(query);

    const userNameFilter = query.userName ? String(query.userName).trim() : '';
    const userNameRegex = userNameFilter
      ? new RegExp(escapeRegex(userNameFilter), 'i')
      : null;

    const result = await this.auditModel
      .aggregate([
        { $match: baseMatch },
        {
          $addFields: {
            userObjectId: {
              $convert: {
                input: '$userId',
                to: 'objectId',
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userObjectId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'roles',
            localField: 'user.role',
            foreignField: '_id',
            as: 'roleDoc',
          },
        },
        { $unwind: { path: '$roleDoc', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            userName: {
              $let: {
                vars: {
                  full: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ['$user.firstName', ''] },
                          ' ',
                          { $ifNull: ['$user.lastName', ''] },
                        ],
                      },
                    },
                  },
                },
                in: {
                  $cond: [
                    { $gt: [{ $strLenCP: '$$full' }, 0] },
                    '$$full',
                    { $ifNull: ['$user.email', null] },
                  ],
                },
              },
            },
            userRole: {
              $ifNull: [
                '$roleDoc.name',
                {
                  $cond: [
                    { $eq: [{ $type: '$user.role' }, 'string'] },
                    '$user.role',
                    {
                      $cond: [
                        { $eq: [{ $type: '$user.role' }, 'objectId'] },
                        { $toString: '$user.role' },
                        null,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        ...(userNameRegex
          ? [
              {
                $match: {
                  $or: [
                    { userName: userNameRegex },
                    { 'user.email': userNameRegex },
                    { 'user.firstName': userNameRegex },
                    { 'user.lastName': userNameRegex },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            data: [
              { $sort: { timestamp: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  userObjectId: 0,
                  user: 0,
                  roleDoc: 0,
                },
              },
            ],
            total: [{ $count: 'total' }],
          },
        },
      ])
      .exec();

    const items = result?.[0]?.data ?? [];
    const total = result?.[0]?.total?.[0]?.total ?? 0;

    return {
      data: items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async generateReport(query: QueryAuditLogsDto) {
    const baseMatch = this.buildBaseMatch(query);

    const userNameFilter = query.userName ? String(query.userName).trim() : '';
    const userNameRegex = userNameFilter
      ? new RegExp(escapeRegex(userNameFilter), 'i')
      : null;

    const result = await this.auditModel
      .aggregate([
        { $match: baseMatch },
        ...(userNameRegex
          ? [
              {
                $addFields: {
                  userObjectId: {
                    $convert: {
                      input: '$userId',
                      to: 'objectId',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userObjectId',
                  foreignField: '_id',
                  as: 'user',
                },
              },
              { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  userName: {
                    $let: {
                      vars: {
                        full: {
                          $trim: {
                            input: {
                              $concat: [
                                { $ifNull: ['$user.firstName', ''] },
                                ' ',
                                { $ifNull: ['$user.lastName', ''] },
                              ],
                            },
                          },
                        },
                      },
                      in: {
                        $cond: [
                          { $gt: [{ $strLenCP: '$$full' }, 0] },
                          '$$full',
                          { $ifNull: ['$user.email', null] },
                        ],
                      },
                    },
                  },
                },
              },
              {
                $match: {
                  $or: [
                    { userName: userNameRegex },
                    { 'user.email': userNameRegex },
                    { 'user.firstName': userNameRegex },
                    { 'user.lastName': userNameRegex },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            totals: [{ $count: 'total' }],
            byAction: [
              { $group: { _id: '$action', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            byEntity: [
              { $group: { _id: '$entity', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
          },
        },
      ])
      .exec();

    const totals = result?.[0]?.totals ?? [];
    const byAction = result?.[0]?.byAction ?? [];
    const byEntity = result?.[0]?.byEntity ?? [];

    return {
      total: totals?.[0]?.total ?? 0,
      byAction: byAction.map((x: any) => ({ action: x._id, count: x.count })),
      byEntity: byEntity.map((x: any) => ({
        entity: x._id ?? 'unknown',
        count: x.count,
      })),
    };
  }
}
