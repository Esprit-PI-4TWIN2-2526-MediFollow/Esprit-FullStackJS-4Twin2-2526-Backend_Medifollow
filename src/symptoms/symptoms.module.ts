import { Module } from '@nestjs/common';
import { SymptomsController } from './symptoms.controller';
import { SymptomsService } from './symptoms.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Symptom, SymptomSchema } from './schemas/symptom.schema';
import { SymptomResponse, SymptomResponseSchema } from './schemas/symptom-response.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Symptom.name, schema: SymptomSchema },
      { name: SymptomResponse.name, schema: SymptomResponseSchema },
    ]),
  ],
  controllers: [SymptomsController],
  providers: [SymptomsService],
})
export class SymptomsModule {}
