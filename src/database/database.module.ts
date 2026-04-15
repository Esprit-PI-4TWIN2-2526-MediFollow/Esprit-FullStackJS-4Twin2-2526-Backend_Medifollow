// src/database/database.module.ts
import {
    Module, Global, Injectable,
    OnModuleInit, OnModuleDestroy, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as mongoose from 'mongoose';
import * as fs from 'fs';

// ── Types ────────────────────────────────────────────
interface SyncOp {
    id: string;
    collection: string;
    operation: string;
    args: any[];
}

// ── 1. DatabaseService ───────────────────────────────
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('DatabaseService');
    private atlasConn: mongoose.Connection | null = null;
    private localConn: mongoose.Connection | null = null;
    private _atlasActive = false;

    constructor(private config: ConfigService) {}

    async onModuleInit() {
        this.localConn = await mongoose
            .createConnection(this.config.get<string>('MONGO_LOCAL_URI')!, {
                serverSelectionTimeoutMS: 5000,
            })
            .asPromise();
        this.logger.log('Local connected');
        await this.tryAtlas();
    }

   async tryAtlas(): Promise<boolean> {
    try {
        const newConn = await mongoose.createConnection(
            this.config.get<string>('MONGODB_URI')!, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            }
        ).asPromise();

        // Swap atomique : nouvelle connexion active AVANT de fermer l'ancienne
        const old = this.atlasConn;
        this.atlasConn = newConn;
        this._atlasActive = true;
        if (old) old.close().catch(() => {});
        
        this.logger.log('Atlas connected');
        return true;
    } catch {
        this._atlasActive = false;
        this.logger.warn('Atlas unreachable — local mode active');
        return false;
    }
}


    // Expose les connexions directement (réutilisées, pas recréées)
    get atlasConnection(): mongoose.Connection | null { return this.atlasConn; }
    get localConnection(): mongoose.Connection | null { return this.localConn; }

    get active(): mongoose.Connection {
        return this._atlasActive ? this.atlasConn! : this.localConn!;
    }

    get isAtlasActive(): boolean { return this._atlasActive; }

    async onModuleDestroy() {
        await this.atlasConn?.close();
        await this.localConn?.close();
    }
}

// ── 2. SyncQueueService ──────────────────────────────
@Injectable()
export class SyncQueueService implements OnModuleInit {
    private queue: SyncOp[] = [];
    private filePath!: string;

    constructor(private config: ConfigService) {}

    onModuleInit() {
        this.filePath = this.config.get<string>('SYNC_QUEUE_PATH') || './sync-queue.json';
        try {
            if (fs.existsSync(this.filePath))
                this.queue = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        } catch {
            this.queue = [];
        }
    }

    push(op: Omit<SyncOp, 'id'>) {
        this.queue.push({
            ...op,
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
        this.persist();
    }

    getAll(): SyncOp[] { return [...this.queue]; }
    size(): number { return this.queue.length; }

    remove(id: string) {
        this.queue = this.queue.filter(o => o.id !== id);
        this.persist();
    }

    private persist() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
    }
}

// ── 3. SyncService ───────────────────────────────────
@Injectable()
export class SyncService {
    private readonly logger = new Logger('SyncService');

    constructor(private db: DatabaseService, private queue: SyncQueueService) {}

    async flush() {
        if (!this.queue.size()) return;
        this.logger.log(`Flushing ${this.queue.size()} queued op(s)…`);
        for (const op of this.queue.getAll()) {
            try {
                await (this.db.active.collection(op.collection) as any)[op.operation](...op.args);
                this.queue.remove(op.id);
            } catch (err) {
                this.logger.error(`Queue op failed (${op.operation} on ${op.collection})`, err);
                break; // stop on first failure — order matters
            }
        }
        this.logger.log(`Flush done. Remaining: ${this.queue.size()}`);
    }
}

// ── 4. AtlasSyncService ──────────────────────────────
//
// FIX — suppressions propagées via une collection _deleted (tombstones)
// FIX — mutex isSyncing pour éviter les crons parallèles
// FIX — connexions réutilisées (DatabaseService) au lieu d'être recréées
// FIX — logs réduits (résumé par collection, pas par document)
//
@Injectable()
export class AtlasSyncService implements OnModuleInit {
    private readonly logger = new Logger('AtlasSyncService');
    private isSyncing = false;

    private readonly collections = [
        'users', 'roles', 'symptoms', 'questionnaires',
        'alerts', 'services', 'communications', 'coordinators',
        'symptomresponses', 'voicecalls', 'dashboards',
    ];

    constructor(
        private db: DatabaseService,
        private config: ConfigService,
    ) {}

    async onModuleInit() {
        setTimeout(() => this.syncAtlasToLocal(), 3000);
    }

    // ── Atlas → Local (every 30s) ──────────────────────
    @Cron(CronExpression.EVERY_30_SECONDS)
    async handleCronAtlasToLocal() {
        if (!this.db.isAtlasActive) {
            this.logger.warn('Atlas down — Atlas→Local sync suspended');
            return;
        }
        await this.syncAtlasToLocal();
    }

    // ── Local → Atlas (every 30s) ──────────────────────
    @Cron(CronExpression.EVERY_30_SECONDS)
    async handleCronLocalToAtlas() {
        if (!this.db.isAtlasActive) return;
        await this.syncLocalToAtlas();
    }

    // ── Sync Local → Atlas ─────────────────────────────
    async syncLocalToAtlas() {
        if (this.isSyncing) return; // mutex
        this.isSyncing = true;
        this.logger.log('Sync Local → Atlas started');

        const local = this.db.localConnection;
        const atlas = this.db.atlasConnection;
        if (!local || !atlas) {
            this.isSyncing = false;
            return;
        }

        try {
            // 1. Propagate tombstones (deletes) first
            await this.applyTombstones(local, atlas);

            // 2. Upsert live documents
            for (const name of this.collections) {
                try {
                    const docs = await local.collection(name)
                        .find({})
                        .toArray();
                    if (!docs.length) continue;

                    const ops = docs.map(doc => ({
                        updateOne: {
                            filter: { _id: doc._id },
                            update: { $set: doc },
                            upsert: true,
                        },
                    }));
                    await atlas.collection(name).bulkWrite(ops, { ordered: false });
                    this.logger.log(`Local → Atlas: ${name} (${docs.length} docs)`);
                } catch (err) {
                    this.logger.error(`Local → Atlas failed for collection ${name}`, err);
                }
            }
        } catch (err) {
            this.logger.error('Local → Atlas sync error', err);
        } finally {
            this.isSyncing = false;
        }
    }

    // ── Sync Atlas → Local ─────────────────────────────
    async syncAtlasToLocal() {
        if (!this.db.isAtlasActive) return;
        if (this.isSyncing) return; // mutex
        this.isSyncing = true;
        this.logger.log('Sync Atlas → Local started');

        const atlas = this.db.atlasConnection;
        const local = this.db.localConnection;
        if (!atlas || !local) {
            this.isSyncing = false;
            return;
        }

        try {
            // 1. Propagate tombstones (deletes) first
            await this.applyTombstones(atlas, local);

            // 2. Upsert live documents
            for (const name of this.collections) {
                try {
                    const docs = await atlas.collection(name)
                        .find({})
                        .toArray();
                    if (!docs.length) continue;

                    const ops = docs.map(doc => ({
                        updateOne: {
                            filter: { _id: doc._id },
                            update: { $set: doc },
                            upsert: true,
                        },
                    }));
                    await local.collection(name).bulkWrite(ops, { ordered: false });
                    this.logger.log(`Atlas → Local: ${name} (${docs.length} docs)`);
                } catch (err) {
                    this.logger.error(`Atlas → Local failed for collection ${name}`, err);
                }
            }
        } catch (err) {
            this.logger.error('Atlas → Local sync error', err);
        } finally {
            this.isSyncing = false;
        }
    }

    // ── Tombstone helper ───────────────────────────────
    //
    // Appelé avant chaque $set bulk pour s'assurer que les suppressions
    // sont appliquées AVANT de ré-upsert des documents vivants.
    //
    // Usage dans les repositories :
    //   await db.active.collection('_deleted').insertOne({
    //     _id: new ObjectId(),
    //     collection: 'users',
    //     docId: deletedDoc._id,
    //     deletedAt: new Date(),
    //   });
    //   await db.active.collection('users').deleteOne({ _id: deletedDoc._id });
    //
    private async applyTombstones(
        source: mongoose.Connection,
        target: mongoose.Connection,
    ) {
        try {
            const tombstones = await source
                .collection('_deleted')
                .find({})
                .toArray();

            if (!tombstones.length) return;

            for (const t of tombstones) {
                try {
                    await target.collection(t.collection).deleteOne({ _id: t.docId });
                } catch {}
            }

            // Mirror tombstones to the target so it won't re-insert
            const tombstoneOps = tombstones.map(t => ({
                updateOne: {
                    filter: { _id: t._id },
                    update: { $set: t },
                    upsert: true,
                },
            }));
            await target.collection('_deleted').bulkWrite(tombstoneOps, { ordered: false });

            this.logger.log(`Tombstones applied: ${tombstones.length} deletion(s)`);
        } catch (err) {
            this.logger.error('Tombstone propagation failed', err);
        }
    }
}

// ── 5. HealthCheckService ────────────────────────────
@Injectable()
export class HealthCheckService implements OnModuleInit {
    private readonly logger = new Logger('HealthCheckService');

    constructor(
        private db: DatabaseService,
        private sync: SyncService,
        private atlasSync: AtlasSyncService,
        private config: ConfigService,
    ) {}

    onModuleInit() {
        const ms = +(this.config.get<string>('MONGO_HEALTH_INTERVAL_MS') || 10000);
        setInterval(async () => {
            const was = this.db.isAtlasActive;
            const now = await this.db.tryAtlas();
            if (!was && now) {
                this.logger.log('Atlas back online — starting sync…');
                await this.sync.flush();
                await this.atlasSync.syncLocalToAtlas();
            }
        }, ms);
    }
}

// ── 6. Module ────────────────────────────────────────
@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: (config: ConfigService) => ({
                uri: config.get<string>('MONGO_LOCAL_URI')!,
                dbName: 'medifollow',
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        DatabaseService,
        SyncQueueService,
        SyncService,
        AtlasSyncService,
        HealthCheckService,
    ],
    exports: [DatabaseService, SyncQueueService, SyncService, MongooseModule],
})
export class DatabaseModule {}