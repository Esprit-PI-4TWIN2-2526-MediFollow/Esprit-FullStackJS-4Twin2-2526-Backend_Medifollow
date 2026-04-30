import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Role } from 'src/role/schemas/role.schema';
import { EmailService } from './email/email.service';
import { User } from './users.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: getModelToken(Role.name),
          useValue: {},
        },
        {
          provide: CloudinaryService,
          useValue: {},
        },
        {
          provide: EmailService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
