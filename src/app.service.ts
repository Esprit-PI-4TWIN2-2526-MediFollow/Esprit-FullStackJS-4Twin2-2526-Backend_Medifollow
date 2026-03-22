import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectConnection() private readonly connection: Connection) { }

  onModuleInit() {
    this.connection.once('open', () => {
      this.logger.log('MongoDB connecté avec succès !');
    });

    this.connection.on('error', (err) => {
      this.logger.error(`Erreur de connexion à MongoDB : ${err.message}`);
    });
  }
  getHello(): string {
    return 'Hello World!♦♦♦♦';
  }

}
