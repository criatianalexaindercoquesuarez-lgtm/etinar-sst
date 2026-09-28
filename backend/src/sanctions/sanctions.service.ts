import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SanctionRule } from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { UserProjectsService } from '../user-projects/user-projects.service';

@Injectable()
export class SanctionsService {
  constructor(
    @InjectRepository(SanctionRule) private rulesRepo: Repository<SanctionRule>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    private userProjectsService: UserProjectsService,
  ) {}

  createRule(data: Partial<SanctionRule>) {
    return this.rulesRepo.save(this.rulesRepo.create(data));
  }

  findAllRules() {
    return this.rulesRepo.find({ order: { createdAt: 'DESC' } });
  }

  updateRule(id: string, data: Partial<SanctionRule>) {
    return this.rulesRepo.update(id, data).then(() => this.rulesRepo.findOne({ where: { id } }));
  }

  findActiveRulesByTrigger(trigger: string) {
    return this.rulesRepo.find({ where: { trigger: trigger as any, active: true } });
  }

  /**
   * Historial de sanciones aplicadas. Un usuario restringido a ciertos
   * proyectos solo ve las sanciones de contratistas que participan en
   * ESOS proyectos.
   */
  async findAllSanctions(actingUser?: any) {
    const scope = await this.userProjectsService.resolveScope(actingUser);

    const where: any = {};
    if (scope.contractorId) {
      where.contractor = { id: scope.contractorId };
    } else if (scope.projectIds) {
      const links = await this.contractorProjectsRepo.find({
        where: { project: { id: In(scope.projectIds) } },
        relations: { contractor: true },
      });
      const ids = [...new Set(links.map((l) => l.contractor.id))];
      where.contractor = { id: In(ids.length ? ids : ['__none__']) };
    }

    return this.sanctionsRepo.find({
      where,
      relations: { rule: true, contractor: true, worker: true, document: { documentType: true } },
      order: { appliedAt: 'DESC' },
    });
  }
}
