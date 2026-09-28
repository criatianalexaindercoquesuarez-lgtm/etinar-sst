import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project, ProjectStatus } from '../entities/project.entity';
import { Contractor, ContractorStatus } from '../entities/contractor.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import { Alert } from '../entities/alert.entity';
import { Worker } from '../entities/worker.entity';
import { Sanction } from '../entities/sanction.entity';
import { SanctionAction } from '../entities/sanction-rule.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { UserProjectsService } from '../user-projects/user-projects.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(Alert) private alertsRepo: Repository<Alert>,
    @InjectRepository(Worker) private workersRepo: Repository<Worker>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    private userProjectsService: UserProjectsService,
  ) {}

  private async getScopedContractorIds(projectIds: string[]): Promise<string[]> {
    if (projectIds.length === 0) return [];
    const links = await this.contractorProjectsRepo.find({
      where: { project: { id: In(projectIds) } },
      relations: { contractor: true },
    });
    return [...new Set(links.map((l) => l.contractor.id))];
  }

  async getSummary(actingUser?: any) {
    const scope = await this.userProjectsService.resolveScope(actingUser);

    const projects = scope.projectIds
      ? await this.projectsRepo.find({ where: { id: In(scope.projectIds) } })
      : await this.projectsRepo.find();

    let contractorIds: string[] | null = null;
    if (scope.contractorId) {
      contractorIds = [scope.contractorId]; // contratista: SOLO su propia empresa
    } else if (scope.projectIds) {
      contractorIds = await this.getScopedContractorIds(scope.projectIds);
    }

    const allContractors = await this.contractorsRepo.find();
    const contractors = contractorIds
      ? allContractors.filter((c) => contractorIds!.includes(c.id))
      : allContractors;

    const docWhere: any = {};
    if (scope.projectIds) docWhere.project = { id: In(scope.projectIds) };
    if (scope.contractorId) docWhere.contractor = { id: scope.contractorId };
    const documents = await this.documentsRepo.find({ where: docWhere });

    const workers = contractorIds
      ? await this.workersRepo.find({
          where: { contractor: { id: In(contractorIds.length ? contractorIds : ['__none__']) } },
        })
      : await this.workersRepo.find();

    const alertWhere: any = { resolved: false };
    if (scope.projectIds) alertWhere.document = { project: { id: In(scope.projectIds) } };
    const alerts = await this.alertsRepo.find({ where: alertWhere, relations: { document: true } });

    const sanctionWhere: any = { rule: { action: SanctionAction.MULTA } };
    if (contractorIds) {
      sanctionWhere.contractor = { id: In(contractorIds.length ? contractorIds : ['__none__']) };
    }
    const sanctions = await this.sanctionsRepo.find({ where: sanctionWhere });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === ProjectStatus.ACTIVO).length;
    const totalContractors = contractors.length;
    const activeContractors = contractors.filter((c) => c.status === ContractorStatus.ACTIVO).length;
    const suspendedContractors = contractors.filter((c) => c.status === ContractorStatus.SUSPENDIDO).length;
    const blockedContractors = contractors.filter((c) => c.status === ContractorStatus.BLOQUEADO).length;

    const totalDocuments = documents.length;
    const approvedDocuments = documents.filter((d) => d.status === DocumentStatus.APROBADO).length;
    const pendingDocuments = documents.filter((d) => d.status === DocumentStatus.PENDIENTE).length;
    const observedDocuments = documents.filter((d) => d.status === DocumentStatus.OBSERVADO).length;
    const rejectedDocuments = documents.filter((d) => d.status === DocumentStatus.RECHAZADO).length;
    const porVencerDocuments = documents.filter((d) => d.status === DocumentStatus.POR_VENCER).length;
    const vencidoDocuments = documents.filter((d) => d.status === DocumentStatus.VENCIDO).length;

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
      workers: {
        total: workers.length,
        blocked: workers.filter((w) => w.blocked).length,
        enabled: workers.filter((w) => !w.blocked).length,
      },
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
      unresolvedAlerts: alerts.length,
      finesCount: sanctions.length,
      semaphore: complianceRate >= 90 ? 'verde' : complianceRate >= 70 ? 'amarillo' : 'rojo',
    };
  }

  async getByProject(actingUser?: any) {
    const scope = await this.userProjectsService.resolveScope(actingUser);
    const projects = scope.projectIds
      ? await this.projectsRepo.find({ where: { id: In(scope.projectIds) } })
      : await this.projectsRepo.find();

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
      const docWhere: any = { project: { id: project.id } };
      if (scope.contractorId) docWhere.contractor = { id: scope.contractorId };
      const docs = await this.documentsRepo.find({ where: docWhere });
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

  async getByContractor(actingUser?: any) {
    const scope = await this.userProjectsService.resolveScope(actingUser);

    let contractors: Contractor[];
    if (scope.contractorId) {
      contractors = await this.contractorsRepo.find({ where: { id: scope.contractorId } });
    } else if (scope.projectIds) {
      const ids = await this.getScopedContractorIds(scope.projectIds);
      contractors = ids.length ? await this.contractorsRepo.find({ where: { id: In(ids) } }) : [];
    } else {
      contractors = await this.contractorsRepo.find();
    }

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
      const docs = await this.documentsRepo.find({ where: { contractor: { id: contractor.id } } });
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
