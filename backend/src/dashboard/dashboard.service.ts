import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../entities/project.entity';
import { Contractor, ContractorStatus } from '../entities/contractor.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import { Alert } from '../entities/alert.entity';
import { Worker } from '../entities/worker.entity';
import { Sanction } from '../entities/sanction.entity';
import { SanctionAction } from '../entities/sanction-rule.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(Alert) private alertsRepo: Repository<Alert>,
    @InjectRepository(Worker) private workersRepo: Repository<Worker>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
  ) {}

  async getSummary() {
    const [
      totalProjects,
      activeProjects,
      totalContractors,
      activeContractors,
      suspendedContractors,
      blockedContractors,
      totalWorkers,
      blockedWorkers,
      totalDocuments,
      approvedDocuments,
      pendingDocuments,
      observedDocuments,
      rejectedDocuments,
      porVencerDocuments,
      vencidoDocuments,
      unresolvedAlerts,
      finesCount,
    ] = await Promise.all([
      this.projectsRepo.count(),
      this.projectsRepo.count({ where: { status: ProjectStatus.ACTIVO } }),
      this.contractorsRepo.count(),
      this.contractorsRepo.count({ where: { status: ContractorStatus.ACTIVO } }),
      this.contractorsRepo.count({ where: { status: ContractorStatus.SUSPENDIDO } }),
      this.contractorsRepo.count({ where: { status: ContractorStatus.BLOQUEADO } }),
      this.workersRepo.count(),
      this.workersRepo.count({ where: { blocked: true } }),
      this.documentsRepo.count(),
      this.documentsRepo.count({ where: { status: DocumentStatus.APROBADO } }),
      this.documentsRepo.count({ where: { status: DocumentStatus.PENDIENTE } }),
      this.documentsRepo.count({ where: { status: DocumentStatus.OBSERVADO } }),
      this.documentsRepo.count({ where: { status: DocumentStatus.RECHAZADO } }),
      this.documentsRepo.count({ where: { status: DocumentStatus.POR_VENCER } }),
      this.documentsRepo.count({ where: { status: DocumentStatus.VENCIDO } }),
      this.alertsRepo.count({ where: { resolved: false } }),
      this.sanctionsRepo.count({ where: { rule: { action: SanctionAction.MULTA } } }),
    ]);

    // Motor de indicadores: el % de cumplimiento SIEMPRE se calcula, nunca se ingresa manualmente
    const complianceRate =
      totalDocuments > 0 ? Math.round((approvedDocuments / totalDocuments) * 100) : 0;

    return {
      projects: { total: totalProjects, active: activeProjects },
      contractors: {
        total: totalContractors,
        active: activeContractors,
        suspended: suspendedContractors,
        blocked: blockedContractors,
      },
      workers: { total: totalWorkers, blocked: blockedWorkers, enabled: totalWorkers - blockedWorkers },
      documents: {
        total: totalDocuments,
        approved: approvedDocuments,
        pending: pendingDocuments,
        observed: observedDocuments,
        rejected: rejectedDocuments,
        porVencer: porVencerDocuments,
        vencido: vencidoDocuments,
      },
      complianceRate,
      unresolvedAlerts,
      finesCount,
      // Semáforo automático de cumplimiento general
      semaphore: complianceRate >= 90 ? 'verde' : complianceRate >= 70 ? 'amarillo' : 'rojo',
    };
  }

  async getByProject() {
    const projects = await this.projectsRepo.find();
    const results: Array<{
      projectId: string;
      code: string;
      name: string;
      totalDocuments: number;
      approvedDocuments: number;
      complianceRate: number;
      semaphore: string;
    }> = [];
    for (const project of projects) {
      const docs = await this.documentsRepo.find({
        where: { project: { id: project.id } },
      });
      const total = docs.length;
      const approved = docs.filter((d) => d.status === DocumentStatus.APROBADO).length;
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
      results.push({
        projectId: project.id,
        code: project.code,
        name: project.name,
        totalDocuments: total,
        approvedDocuments: approved,
        complianceRate: rate,
        semaphore: rate >= 90 ? 'verde' : rate >= 70 ? 'amarillo' : 'rojo',
      });
    }
    return results;
  }

  async getByContractor() {
    const contractors = await this.contractorsRepo.find();
    const results: Array<{
      contractorId: string;
      name: string;
      status: string;
      totalDocuments: number;
      approvedDocuments: number;
      complianceRate: number;
      semaphore: string;
    }> = [];
    for (const contractor of contractors) {
      const docs = await this.documentsRepo.find({
        where: { contractor: { id: contractor.id } },
      });
      const total = docs.length;
      const approved = docs.filter((d) => d.status === DocumentStatus.APROBADO).length;
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
      results.push({
        contractorId: contractor.id,
        name: contractor.legalName,
        status: contractor.status,
        totalDocuments: total,
        approvedDocuments: approved,
        complianceRate: rate,
        semaphore: rate >= 90 ? 'verde' : rate >= 70 ? 'amarillo' : 'rojo',
      });
    }
    return results.sort((a, b) => b.complianceRate - a.complianceRate);
  }
}
