import { Controller, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ComplianceEngineService } from './compliance-engine.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('engine')
export class ComplianceEngineController {
  constructor(private engine: ComplianceEngineService) {}

  /**
   * Ejecuta bajo demanda la misma revisión que corre automáticamente
   * todos los días a la 1:00 AM (@Cron). Útil para pruebas y para que
   * un administrador fuerce la revisión sin esperar al job nocturno.
   */
  @Post('run-daily-check')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'coordinador_sst')
  runNow() {
    return this.engine.runDailyCheck();
  }

  /**
   * Endpoint pensado para un disparador externo (ej. cron-job.org), no para
   * el navegador. No usa login de usuario: se protege con una clave
   * compartida (CRON_SECRET) configurada como variable de entorno.
   *
   * Por qué existe: en hosting gratuito (Render free tier) el servidor se
   * "duerme" tras 15 minutos sin tráfico, así que el @Cron interno no se
   * dispara si nadie visita el sitio esa noche. Un ping externo diario a
   * esta URL despierta el servidor Y ejecuta la revisión en el mismo paso.
   *
   * Uso: POST /api/engine/cron-trigger?secret=TU_CRON_SECRET
   */
  @Post('cron-trigger')
  runViaExternalCron(@Query('secret') secret: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Clave de disparo inválida o no configurada');
    }
    return this.engine.runDailyCheck();
  }
}
