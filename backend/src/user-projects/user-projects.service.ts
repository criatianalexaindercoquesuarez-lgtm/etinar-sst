import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProject } from '../entities/user-project.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { AuditService } from '../common/audit.service';

export interface AccessScope {
  /** null = sin restricción (ve todos los proyectos) */
  projectIds: string[] | null;
  /** null = no es un contratista, o ve todos los contratistas dentro de su alcance */
  contractorId: string | null;
}

@Injectable()
export class UserProjectsService {
  constructor(
    @InjectRepository(UserProject) private userProjectsRepo: Repository<UserProject>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    private auditService: AuditService,
  ) {}

  async getAssignedProjectIds(userId: string): Promise<string[]> {
    const links = await this.userProjectsRepo.find({
      where: { user: { id: userId } },
      relations: { project: true },
    });
    return links.map((l) => l.project.id);
  }

  async isRestricted(userId: string): Promise<boolean> {
    const count = await this.userProjectsRepo.count({ where: { user: { id: userId } } });
    return count > 0;
  }

  async listAssignments(userId: string) {
    return this.userProjectsRepo.find({
      where: { user: { id: userId } },
      relations: { project: true },
      order: { createdAt: 'DESC' },
    });
  }

  async assign(userId: string, projectId: string, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const existing = await this.userProjectsRepo.findOne({
      where: { user: { id: userId }, project: { id: projectId } },
    });
    if (existing) return existing;

    const link = await this.userProjectsRepo.save(
      this.userProjectsRepo.create({ user, project }),
    );

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'USER_PROJECT_ASSIGN',
      entityType: 'UserProject',
      entityId: link.id,
      details: `${user.fullName} restringido/asignado a proyecto ${project.code}`,
    });

    return link;
  }

  async unassign(linkId: string, actingUser: any) {
    const link = await this.userProjectsRepo.findOne({
      where: { id: linkId },
      relations: { user: true, project: true },
    });
    if (!link) throw new NotFoundException('Asignación no encontrada');

    await this.userProjectsRepo.delete(linkId);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'USER_PROJECT_UNASSIGN',
      entityType: 'UserProject',
      entityId: linkId,
      details: `${link.user.fullName} desasignado de proyecto ${link.project.code}`,
    });

    return { success: true };
  }

  /**
   * Punto único de verdad sobre "qué puede ver" el usuario que hace la
   * petición. Se usa en Dashboard, Reportes y Sanciones para que todos
   * apliquen exactamente la misma regla:
   *
   * - Contratista: SOLO su propia empresa (contractorId fijo), dentro de
   *   los proyectos a los que su empresa está asignada.
   * - Usuario interno (admin/coordinador_sst/director) CON proyectos
   *   asignados (UserProject): solo esos proyectos, cualquier contratista
   *   dentro de ellos.
   * - Usuario interno SIN restricción: sin límites (comportamiento
   *   histórico, no rompe nada existente).
   */
  async resolveScope(actingUser: any): Promise<AccessScope> {
    if (!actingUser) return { projectIds: null, contractorId: null };

    if (actingUser.role === 'contratista') {
      const links = await this.contractorProjectsRepo.find({
        where: { contractor: { id: actingUser.contractorId } },
        relations: { project: true },
      });
      return {
        projectIds: links.map((l) => l.project.id),
        contractorId: actingUser.contractorId,
      };
    }

    if (actingUser.userId) {
      const projectIds = await this.getAssignedProjectIds(actingUser.userId);
      return {
        projectIds: projectIds.length > 0 ? projectIds : null,
        contractorId: null,
      };
    }

    return { projectIds: null, contractorId: null };
  }
}
