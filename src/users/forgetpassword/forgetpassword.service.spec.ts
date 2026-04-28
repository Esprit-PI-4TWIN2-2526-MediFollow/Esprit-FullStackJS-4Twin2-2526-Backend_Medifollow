import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from '../users.schema';
import { ForgetpasswordService } from './forgetpassword.service';

describe('ForgetpasswordService', () => {
  let service: ForgetpasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgetpasswordService,
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ForgetpasswordService>(ForgetpasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
