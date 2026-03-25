import { Test, TestingModule } from '@nestjs/testing';
import { SymptomsService } from './symptoms.service';
import { getModelToken } from '@nestjs/mongoose';
import { Symptom } from './schemas/symptom.schema';
import { SymptomResponse } from './schemas/symptom-response.schema';
import { User } from 'src/users/users.schema';

describe('SymptomsService', () => {
  let service: SymptomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SymptomsService,
        {
          provide: getModelToken(Symptom.name),
          useValue: {},
        },
        {
          provide: getModelToken(SymptomResponse.name),
          useValue: {},
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SymptomsService>(SymptomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
