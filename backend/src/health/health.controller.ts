import { Controller, Get, Res } from '@nestjs/common';
import type { HealthResponse } from '@apniride/shared';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** 200 when Postgres (with PostGIS) and Redis are reachable, 503 otherwise. */
  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
}
