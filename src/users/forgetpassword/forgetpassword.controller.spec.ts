import { Test, TestingModule } from '@nestjs/testing';
import { ForgetpasswordController } from './forgetpassword.controller';

describe('ForgetpasswordController', () => {
  let controller: ForgetpasswordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForgetpasswordController],
    }).compile();

    controller = module.get<ForgetpasswordController>(ForgetpasswordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
