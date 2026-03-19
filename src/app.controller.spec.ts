import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    const appService = {
      getHello: () => 'Hello World!',
    };

    appController = new AppController(appService as any);
  });

  it('should return Hello World!', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });
});