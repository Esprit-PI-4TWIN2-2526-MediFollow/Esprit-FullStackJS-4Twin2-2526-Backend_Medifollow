import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private register = new client.Registry();

  constructor() {
    client.collectDefaultMetrics({ register: this.register });
  }

  async getMetrics() {
    return this.register.metrics();
  }
}