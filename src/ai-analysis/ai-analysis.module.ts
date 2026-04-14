import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from 'src/users/users.module';
import { Analysis, AnalysisSchema } from './schemas/analysis.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    HttpModule,
     MongooseModule.forFeature([{ name: Analysis.name, schema: AnalysisSchema }]),
    UsersModule,           // Pour récupérer les infos du patient
  ],
  providers: [AnalysisService],
  controllers: [AnalysisController],
  exports: [AnalysisService], // Exporter le service pour l'utiliser dans d'autres modules
})
export class AiAnalysisModule {}
