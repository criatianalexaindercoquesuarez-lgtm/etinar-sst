import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityTemplate, Am196Requirement } from './internal.entities';
import { ACTIVITY_SEED, AM196_SEED } from './seed-data';

/**
 * Carga los catálogos base (actividades por rol y requisitos del AM 196) solo
 * si no existen. Nunca sobrescribe lo que la Coordinación SST haya editado.
 */
@Injectable()
export class InternalSeedService implements OnModuleInit {
  private readonly logger = new Logger(InternalSeedService.name);

  constructor(
    @InjectRepository(ActivityTemplate) private templatesRepo: Repository<ActivityTemplate>,
    @InjectRepository(Am196Requirement) private reqRepo: Repository<Am196Requirement>,
  ) {}

  async onModuleInit() {
    try {
      const existingT = new Set((await this.templatesRepo.find({ select: { code: true } })).map((t) => t.code));
      const newT = ACTIVITY_SEED.filter((a) => !existingT.has(a.code)).map((a, i) =>
        this.templatesRepo.create({ ...a, sortOrder: i, active: true }),
      );
      if (newT.length) await this.templatesRepo.save(newT);

      const existingR = new Set((await this.reqRepo.find({ select: { code: true } })).map((r) => r.code));
      const newR: Am196Requirement[] = [];
      let order = 0;
      for (const sec of AM196_SEED) {
        for (const [code, description, legalRef, validityDays, evidenceType, discipline, keywords] of sec.items) {
          order++;
          if (existingR.has(code)) continue;
          newR.push(
            this.reqRepo.create({ code, section: sec.section, description, legalRef, validityDays, evidenceType, discipline, keywords, sortOrder: order, active: true }),
          );
        }
      }
      if (newR.length) await this.reqRepo.save(newR);
      if (newT.length || newR.length) {
        this.logger.log(`Documentación interna: catálogo inicial cargado (${newT.length} actividades, ${newR.length} requisitos AM 196).`);
      }
    } catch (err) {
      this.logger.error(`No se pudo cargar el catálogo de documentación interna: ${err}`);
    }
  }
}
