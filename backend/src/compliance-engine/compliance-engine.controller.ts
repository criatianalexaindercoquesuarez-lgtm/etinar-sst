import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ComplianceEngineService } from './compliance-engine.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('engine')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ComplianceEngineController {
  constructor(private engine: ComplianceEngineService) {}

  /**
   * Ejecuta bajo demanda la misma revisión que corre automáticamente
   * todos los días a la 1:00 AM (@Cron). Útil para pruebas y para que
   * un administrador fuerce la revisión sin esperar al job nocturno.
   */
  @Post('run-daily-check')
  @Roles('admin', 'coordinador_sst')
  runNow() {
    return this.engine.runDailyCheck();
  }
}
