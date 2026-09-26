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

  /**
   * Si el usuario tiene proyectos asignados (restringido), devuelve esos
   * IDs. Si no tiene ninguno (acceso global, comportamiento por defecto),
   * devuelve null — "sin restricción".
   */
  private async getScope(actingUser?: any): Promise<string[] | null> {
    if (!actingUser?.userId) return null;
    const ids = await this.userProjectsService.getAssignedProjectIds(actingUser.userId);
    return ids.length > 0 ? ids : null;
  }

  private async getScopedContractorIds(projectIds: string[]): Promise<string[]> {
    const links = await this.contractorProjectsRepo.find({
      where: { project: { id: In(projectIds) } },
      relations: { contractor: true },
    });
    return [...new Set(links.map((l) => l.contractor.id))];
  }

  async getSummary(actingUser?: any) {
    const scope = await this.getScope(actingUser);

    const [projects, allContractors, contractorIds] = await Promise.all([
      scope
        ? this.projectsRepo.find({ where: { id: In(scope) } })
        : this.projectsRepo.find(),
      this.contractorsRepo.find(),
      scope ? this.getScopedContractorIds(scope) : null,
    ]);

    const contractors = scope
      ? allContractors.filter((c) => contractorIds!.includes(c.id))
      : allContractors;

    const documents = scope
      ? await this.documentsRepo.find({ where: { project: { id: In(scope) } } })
      : await this.documentsRepo.find();

    const workers = scope
      ? await this.workersRepo.find({ where: { contractor: { id: In(contractorIds!.length ? contractorIds! : ['__none__']) } } })
      : await this.workersRepo.find();

    const alerts = scope
      ? await this.alertsRepo.find({
          where: { resolved: false, document: { project: { id: In(scope) } } },
          relations: { document: true },
        })
      : await this.alertsRepo.find({ where: { resolved: false } });

    const sanctions = scope
      ? await this.sanctionsRepo.find({
          where: { rule: { action: SanctionAction.MULTA }, contractor: { id: In(contractorIds!.length ? contractorIds! : ['__none__']) } },
        })
      : await this.sanctionsRepo.find({ where: { rule: { action: SanctionAction.MULTA } } });

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
    const scope = await this.getScope(actingUser);
    const projects = scope
      ? await this.projectsRepo.find({ where: { id: In(scope) } })
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
      const docs = await this.documentsRepo.find({ where: { project: { id: project.id } } });
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
    const scope = await this.getScope(actingUser);
    const contractors = scope
      ? await (async () => {
          const ids = await this.getScopedContractorIds(scope);
          return ids.length
            ? this.contractorsRepo.find({ where: { id: In(ids) } })
            : [];
        })()
      : await this.contractorsRepo.find();

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
