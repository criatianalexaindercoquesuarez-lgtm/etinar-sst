import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contractor } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Project } from '../entities/project.entity';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    private auditService: AuditService,
  ) {}

  async create(data: Partial<Contractor>, actingUser: any) {
    const contractor = this.contractorsRepo.create(data);
    const saved = await this.contractorsRepo.save(contractor);
    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'CONTRACTOR_CREATE',
      entityType: 'Contractor',
      entityId: saved.id,
      details: `${saved.legalName} (RUC ${saved.ruc})`,
    });
    return saved;
  }

  findAll() {
    return this.contractorsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const contractor = await this.contractorsRepo.findOne({
      where: { id },
      relations: { workers: true, contractorProjects: { project: true } },
    });
    if (!contractor) throw new NotFoundException('Contratista no encontrado');
    return contractor;
  }

  async assignToProject(contractorId: string, projectId: string, actingUser: any) {
    const contractor = await this.findOne(contractorId);
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const link = this.contractorProjectsRepo.create({ contractor, project });
    const saved = await this.contractorProjectsRepo.save(link);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'CONTRACTOR_ASSIGN_PROJECT',
      entityType: 'ContractorProject',
      entityId: saved.id,
      details: `Contratista ${contractor.legalName} asignado a proyecto ${project.code}`,
    });

    return saved;
  }

  async update(id: string, data: Partial<Contractor>, actingUser: any) {
    await this.findOne(id);
    await this.contractorsRepo.update(id, data);
    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'CONTRACTOR_UPDATE',
      entityType: 'Contractor',
      entityId: id,
    });
    return this.findOne(id);
  }
}
