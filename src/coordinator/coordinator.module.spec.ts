import { CoordinatorController } from './coordinator.controller';
import { CoordinatorModule } from './coordinator.module';
import { CoordinatorService } from './coordinator.service';

describe('CoordinatorModule', () => {
  it('should be defined', () => {
    expect(CoordinatorModule).toBeDefined();
  });

  it('should register coordinator controller and service metadata', () => {
    const controllers = Reflect.getMetadata('controllers', CoordinatorModule) as unknown[];
    const providers = Reflect.getMetadata('providers', CoordinatorModule) as unknown[];

    expect(controllers).toContain(CoordinatorController);
    expect(providers).toContain(CoordinatorService);
  });
});
