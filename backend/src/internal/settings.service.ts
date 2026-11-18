import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalSetting } from './internal.entities';

export const SETTING_DEFAULTS: Record<string, string> = {
  /** Destinatarios de reportes (separados por coma) */
  reportRecipients: process.env.INTERNAL_REPORT_RECIPIENTS || 'acoque@etinar.com',
  weeklyEnabled: 'true',
  monthlyEnabled: 'true',
  /** Día de envío del reporte semanal (1=lunes … 7=domingo), sobre la semana anterior */
  weeklyDay: '2',
  /** Día del mes de envío del reporte mensual, sobre el mes anterior */
  monthlyDay: '6',
  /** Correo diario con alertas nuevas (vencimientos, AM 196 desactualizado) */
  alertDigest: 'true',
  /** Semanas hacia atrás para construir el historial la primera vez */
  backfillWeeks: '8',
  /** Enlace de la carpeta general con las carpetas de SST de todas las obras */
  rootLinkSst: '',
  /** Enlace de la carpeta de Auditoría MDT / AM 196 */
  rootLinkMdt: '',
};

@Injectable()
export class InternalSettingsService {
  constructor(@InjectRepository(InternalSetting) private repo: Repository<InternalSetting>) {}

  async all(): Promise<Record<string, string>> {
    const rows = await this.repo.find();
    const out = { ...SETTING_DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async get(key: string): Promise<string> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.value : SETTING_DEFAULTS[key];
  }

  async set(values: Record<string, string>) {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in SETTING_DEFAULTS)) continue;
      const existing = await this.repo.findOne({ where: { key } });
      if (existing) {
        existing.value = String(value);
        await this.repo.save(existing);
      } else {
        await this.repo.save(this.repo.create({ key, value: String(value) }));
      }
    }
    return this.all();
  }

  async recipients(): Promise<string[]> {
    return (await this.get('reportRecipients'))
      .split(/[;,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /.+@.+\..+/.test(s));
  }
}
