import { Module } from '@nestjs/common';
import { SymptomsController } from './symptoms.controller';
import { SymptomsService } from './symptoms.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Symptom, SymptomSchema } from './symptom.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Symptom.name, schema: SymptomSchema }
    ])
  ],
  controllers: [SymptomsController],
  providers: [SymptomsService],
})
export class SymptomsModule {}