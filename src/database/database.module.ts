// src/database/database.module.ts
import { Module, Global, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as mongoose from 'mongoose';
import * as fs from 'fs';

// ── 1. DatabaseService ──────────────────────────────
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('DatabaseService');
    private atlasConn: mongoose.Connection | null = null;
    private localConn: mongoose.Connection | null = null;
    private _atlasActive = false;

    constructor(private config: ConfigService) { }

    async onModuleInit() {
        this.localConn = await mongoose
            .createConnection(this.config.get<string>('MONGO_LOCAL_URI')!, {
                serverSelectionTimeoutMS: 5000,
            }).asPromise();
        this.logger.log('Local connecté');
        await this.tryAtlas();
    }

 async tryAtlas(): Promise<boolean> {
    try {
        if (this.atlasConn) {
            try { await this.atlasConn.close(); } catch { }
            this.atlasConn = null;
        }
        this.atlasConn = await mongoose
            .createConnection(this.config.get<string>('MONGODB_URI')!, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            }).asPromise();
        
        if (!this._atlasActive) { 
            this.logger.log(' Atlas connecté');
        }
        this._atlasActive = true;
        return true;
    } catch {
        this.atlasConn = null;
        if (this._atlasActive) { 
            this.logger.warn(' Atlas down — mode local actif');
        }
        this._atlasActive = false;
        return false;
    }
}

    get active() { return this._atlasActive ? this.atlasConn! : this.localConn!; }
    get isAtlasActive() { return this._atlasActive; }

    async onModuleDestroy() {
        await this.atlasConn?.close();
        await this.localConn?.close();
    }
}

// ── 2. SyncQueueService ─────────────────────────────
@Injectable()
export class SyncQueueService implements OnModuleInit {
    private queue: any[] = [];
    private filePath!: string;

    constructor(private config: ConfigService) { }

    onModuleInit() {
        this.filePath = this.config.get<string>('SYNC_QUEUE_PATH') || './sync-queue.json';
        try {
            if (fs.existsSync(this.filePath))
                this.queue = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        } catch { this.queue = []; }
    }

    push(op: { collection: string; operation: string; args: any[] }) {
        this.queue.push({ ...op, id: Date.now() + '-' + Math.random().toString(36).slice(2) });
        fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
    }

    getAll() { return [...this.queue]; }
    size() { return this.queue.length; }
    remove(id: string) {
        this.queue = this.queue.filter(o => o.id !== id);
        fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
    }
}

// ── 3. SyncService ──────────────────────────────────
@Injectable()
export class SyncService {
    private readonly logger = new Logger('SyncService');

    constructor(private db: DatabaseService, private queue: SyncQueueService) { }

    async flush() {
        if (!this.queue.size()) return;
        this.logger.log(`Sync: ${this.queue.size()} op(s)`);
        for (const op of this.queue.getAll()) {
            try {
                await (this.db.active.collection(op.collection) as any)[op.operation](...op.args);
                this.queue.remove(op.id);
            } catch { break; }
        }
        this.logger.log(`Sync terminée. Restant: ${this.queue.size()}`);
    }
}
// ── 4. AtlasSyncService ─────────────────────────────
@Injectable()
export class AtlasSyncService implements OnModuleInit {
    private readonly logger = new Logger('AtlasSyncService');
    private readonly collections = [
        'users', 'roles', 'symptoms', 'questionnaires',
        'alerts', 'services', 'communications', 'coordinators',
        'symptomresponses', 'voicecalls', 'dashboards'
    ];

    constructor(
        private db: DatabaseService,
        private config: ConfigService,
    ) { }

    async onModuleInit() {
        setTimeout(() => this.syncAtlasToLocal(), 3000);
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async handleCronAtlasToLocal() {
        if (this.db.isAtlasActive) {
            await this.syncAtlasToLocal();
        }
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async handleCronLocalToAtlas() {
        if (this.db.isAtlasActive) {
            await this.syncLocalToAtlas();
        }
    }

    async syncLocalToAtlas() {
        let localConn: mongoose.Connection | null = null;
        let atlasConn: mongoose.Connection | null = null;
        try {
            localConn = await mongoose
                .createConnection('mongodb://localhost:27017/medifollow', {
                    dbName: 'medifollow',
                }).asPromise();
            atlasConn = await mongoose
                .createConnection(this.config.get<string>('MONGODB_URI')!, {
                    dbName: 'db_medifollow',
                }).asPromise();

            for (const name of this.collections) {
                try {
                    const docs = await localConn.collection(name).find({}).toArray();
                    if (!docs.length) continue;
                    for (const doc of docs) {
                        await atlasConn.collection(name).updateOne(
                            { _id: doc._id },
                            { $set: doc },
                            { upsert: true }
                        );
                    }
                } catch { continue; }
            }
        } catch (e) {
            this.logger.error('❌ Erreur sync Local → Atlas', e);
        } finally {
            await localConn?.close();
            await atlasConn?.close();
        }
    }

    async syncAtlasToLocal() {
        if (!this.db.isAtlasActive) return;
        let atlasConn: mongoose.Connection | null = null;
        let localConn: mongoose.Connection | null = null;
        try {
            atlasConn = await mongoose
                .createConnection(this.config.get<string>('MONGODB_URI')!, {
                    dbName: 'db_medifollow',
                }).asPromise();
            localConn = await mongoose
                .createConnection('mongodb://localhost:27017/medifollow', {
                    dbName: 'medifollow',
                }).asPromise();

            for (const name of this.collections) {
                try {
                    const docs = await atlasConn.collection(name).find({}).toArray();
                    if (!docs.length) continue;
                    for (const doc of docs) {
                        await localConn.collection(name).updateOne(
                            { _id: doc._id },
                            { $set: doc },
                            { upsert: true }
                        );
                    }
                } catch { continue; }
            }
        } catch (e) {
            this.logger.error('❌ Erreur sync Atlas → Local', e);
        } finally {
            await atlasConn?.close();
            await localConn?.close();
        }
    }
}

// ── 5. HealthCheckService ───────────────────────────
@Injectable()
export class HealthCheckService implements OnModuleInit {
    private readonly logger = new Logger('HealthCheckService');

    constructor(
        private db: DatabaseService,
        private sync: SyncService,
        private atlasSync: AtlasSyncService,
        private config: ConfigService,
    ) { }

    onModuleInit() {
        const ms = +(this.config.get<string>('MONGO_HEALTH_INTERVAL_MS') || 10000);
        setInterval(async () => {
            const was = this.db.isAtlasActive;
            const now = await this.db.tryAtlas();
            if (!was && now) {
                this.logger.log('✅ Atlas revenu — sync en cours...');
                await this.sync.flush();
                await this.atlasSync.syncLocalToAtlas();
            }
        }, ms);
    }
}

// ── 6. Module ───────────────────────────────────────
@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            imports: [ConfigModule], 

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
export class DatabaseModule { }