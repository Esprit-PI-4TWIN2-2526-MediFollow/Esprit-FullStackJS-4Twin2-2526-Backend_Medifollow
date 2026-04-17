// import {
//     Module,
//     Global,
//     Injectable,
//     OnModuleInit,
//     OnModuleDestroy,
//     Logger
// } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import * as mongoose from 'mongoose';
// import * as fs from 'fs';


// // ─────────────────────────────────────────────
// // 1. DatabaseService
// // ─────────────────────────────────────────────
// @Injectable()
// export class DatabaseService implements OnModuleInit, OnModuleDestroy {
//     private readonly logger = new Logger('DatabaseService');

//     private atlasConn: mongoose.Connection | null = null;
//     private localConn: mongoose.Connection | null = null;
//     private _atlasActive = false;

//     constructor(private config: ConfigService) {}

//     async onModuleInit() {
//         this.localConn = await mongoose.createConnection(
//             this.config.get<string>('MONGO_LOCAL_URI')!,
//             { dbName: 'medifollow' }
//         ).asPromise();

//         this.logger.log('Local connecté');

//         await this.tryAtlas();
//     }

//     async tryAtlas(): Promise<boolean> {
//         try {
//             if (this.atlasConn) {
//                 await this.atlasConn.close();
//             }

//             this.atlasConn = await mongoose.createConnection(
//                 this.config.get<string>('MONGODB_URI')!,
//                 { dbName: 'db_medifollow' }
//             ).asPromise();

//             this._atlasActive = true;
//             this.logger.log('Atlas connecté');
//             return true;
//         } catch {
//             this._atlasActive = false;
//             this.atlasConn = null;
//             this.logger.warn('Atlas down → mode local actif');
//             return false;
//         }
//     }

//     get local() {
//         return this.localConn!;
//     }

//     get atlas() {
//         return this.atlasConn!;
//     }

//     get isAtlasActive() {
//         return this._atlasActive;
//     }

//     async onModuleDestroy() {
//         await this.atlasConn?.close();
//         await this.localConn?.close();
//     }
// }


// // ─────────────────────────────────────────────
// // 2. SyncQueueService (offline queue)
// // ─────────────────────────────────────────────
// @Injectable()
// export class SyncQueueService implements OnModuleInit {
//     private queue: SyncOp[] = [];
//     private filePath!: string;

//     constructor(private config: ConfigService) {}

//     onModuleInit() {
//         this.filePath = this.config.get<string>('SYNC_QUEUE_PATH') || './sync-queue.json';

//         try {
//             if (fs.existsSync(this.filePath)) {
//                 this.queue = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
//             }
//         } catch {
//             this.queue = [];
//         }
//     }

//     push(op: { collection: string; operation: string; args: any[] }) {
//         this.queue.push({
//             ...op,
//             id: Date.now() + '-' + Math.random().toString(36).slice(2)
//         });

//         fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
//     }

//     getAll() {
//         return [...this.queue];
//     }

//     size() {
//         return this.queue.length;
//     }

//     remove(id: string) {
//         this.queue = this.queue.filter(o => o.id !== id);
//         this.persist();
//     }

//     private persist() {
//         fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
//     }
// }


// // ─────────────────────────────────────────────
// // 3. SyncService (queue flush)
// // ─────────────────────────────────────────────
// @Injectable()
// export class SyncService {
//     private readonly logger = new Logger('SyncService');

//     constructor(
//         private db: DatabaseService,
//         private queue: SyncQueueService
//     ) {}

//     async flush() {
//         if (!this.queue.size() || !this.db.isAtlasActive) return;

//         this.logger.log(`Sync queue: ${this.queue.size()} op(s)`);

//         for (const op of this.queue.getAll()) {
//             try {
//                 await (this.db.atlas.collection(op.collection) as any)[op.operation](...op.args);
//                 this.queue.remove(op.id);
//             } catch {
//                 break;
//             }
//         }
//     }
// }


// // ─────────────────────────────────────────────
// // 4. AtlasSyncService (SYNC BIDIRECTIONNELLE)
// // ─────────────────────────────────────────────
// @Injectable()
// export class AtlasSyncService implements OnModuleInit {
//     private readonly logger = new Logger('AtlasSyncService');

//     private readonly collections = [
//         'users',
//         'roles',
//         'symptoms',
//         'questionnaires',
//         'alerts',
//         'services',
//         'symptomresponses',
//         'authenticators',
//         'consultations',
//         'medicaldocuments',
//         'messages',
//         'prescriptions',
//         'questionnaireresponses',
//         'videosessions',
//         'voicecallsessions'
//     ];

//     constructor(private db: DatabaseService) {}

//     async onModuleInit() {
//         setTimeout(() => this.syncBothWays(), 3000);
//     }

//     // ── Atlas → Local (every 30s) ──────────────────────
//     @Cron(CronExpression.EVERY_30_SECONDS)
//     async handleSync() {
//         if (!this.db.isAtlasActive) {
//             this.logger.warn('Atlas down → sync suspendue');
//             return;
//         }

//         await this.syncBothWays();
//     }

//     async syncBothWays() {
//         await this.sync(this.db.local, this.db.atlas, 'Local → Atlas');
//         await this.sync(this.db.atlas, this.db.local, 'Atlas → Local');
//     }

//     private async sync(
//         source: mongoose.Connection,
//         target: mongoose.Connection,
//         label: string
//     ) {
//         this.logger.log(`Sync ${label}...`);

//         for (const name of this.collections) {
//             try {
//                 const sourceDocs = await source.collection(name).find({}).toArray();
//                 const targetDocs = await target.collection(name).find({}).toArray();

//                 const sourceMap = new Map(sourceDocs.map(d => [d._id.toString(), d]));
//                 const targetMap = new Map(targetDocs.map(d => [d._id.toString(), d]));

//                 // UPSERT
//                 for (const [id, doc] of sourceMap) {
//                     await target.collection(name).updateOne(
//                         { _id: doc._id },
//                         { $set: doc },
//                         { upsert: true }
//                     );
//                 }

//                 // DELETE
//                 for (const [id] of targetMap) {
//                     if (!sourceMap.has(id)) {
//                         await target.collection(name).deleteOne({
//                             _id: new mongoose.Types.ObjectId(id),
//                         });
//                     }
//                 }

//                 this.logger.log(`${label}: ${name} (${sourceDocs.length} docs)`);
//             } catch (e) {
//                 this.logger.warn(`${label}: erreur sur ${name}`);
//             }
//         }
//     }
// }


// // ─────────────────────────────────────────────
// // 5. HealthCheckService
// // ─────────────────────────────────────────────
// @Injectable()
// export class HealthCheckService implements OnModuleInit {
//     private readonly logger = new Logger('HealthCheckService');

//     constructor(
//         private db: DatabaseService,
//         private sync: SyncService,
//         private atlasSync: AtlasSyncService,
//         private config: ConfigService
//     ) {}

//     onModuleInit() {
//         const ms = +(this.config.get<string>('MONGO_HEALTH_INTERVAL_MS') || 10000);
//         setInterval(async () => {
//             const was = this.db.isAtlasActive;
//             const now = await this.db.tryAtlas();

//             if (!was && now) {
//                 this.logger.log('Atlas revenu → sync déclenchée');

//                 await this.sync.flush();
//                 await this.atlasSync.syncBothWays();
//             }
//         }, ms);
//     }
// }


// // ─────────────────────────────────────────────
// // 6. MODULE
// // ─────────────────────────────────────────────
// @Global()
// @Module({
//     imports: [
//         MongooseModule.forRootAsync({
//             useFactory: (config: ConfigService) => ({
//                 uri: config.get<string>('MONGO_LOCAL_URI')!,
//                 dbName: 'medifollow',
//             }),
//             inject: [ConfigService],
//         }),
//     ],
//     providers: [
//         DatabaseService,
//         SyncQueueService,
//         SyncService,
//         AtlasSyncService,
//         HealthCheckService,
//     ],
//     exports: [
//         DatabaseService,
//         SyncQueueService,
//         SyncService,
//         MongooseModule
//     ],
// })
// export class DatabaseModule {}
