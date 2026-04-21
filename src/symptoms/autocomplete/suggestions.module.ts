import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsGateway } from './suggestions.gateway';
import { User, UserSchema } from 'src/users/users.schema';
import { SymptomResponse, SymptomResponseSchema } from '../schemas/symptom-response.schema';

@Module({
  imports: [
    
    MongooseModule.forFeature([
      { name: SymptomResponse.name, schema: SymptomResponseSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [SuggestionsService, SuggestionsGateway],
  exports: [SuggestionsService,  SuggestionsGateway],
})
export class SuggestionsModule {}