import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { SymptomsService } from 'src/symptoms/symptoms.service';
import { User } from 'src/users/users.schema';
import { VoiceCallsService } from './voice-calls.service';
import { VoiceCallSession } from './schemas/voice-call-session.schema';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

describe('VoiceCallsService', () => {
  let service: VoiceCallsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceCallsService,
        {
          provide: getModelToken(VoiceCallSession.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: SymptomsService,
          useValue: {
            findFormByPatient: jest.fn(),
            getTodayResponse: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VoiceCallsService>(VoiceCallsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
