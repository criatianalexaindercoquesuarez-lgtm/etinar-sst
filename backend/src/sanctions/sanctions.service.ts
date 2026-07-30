import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SanctionRule } from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';

@Injectable()
export class SanctionsService {
  constructor(
    @InjectRepository(SanctionRule) private rulesRepo: Repository<SanctionRule>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
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

  findAllSanctions() {
    return this.sanctionsRepo.find({
      relations: { rule: true, contractor: true, worker: true, document: { documentType: true } },
      order: { appliedAt: 'DESC' },
    });
  }
}
