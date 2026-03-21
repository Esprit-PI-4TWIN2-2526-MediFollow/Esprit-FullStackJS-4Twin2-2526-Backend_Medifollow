import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './service.schema';
import { AiGeneratorController } from './ai/ai-generator.controller';
import { AiGeneratorService } from './ai/ai-generator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [ServiceController, AiGeneratorController],
  providers: [ServiceService, AiGeneratorService],
})
export class ServiceModule {}
