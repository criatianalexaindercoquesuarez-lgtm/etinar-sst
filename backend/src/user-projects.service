import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProject } from '../entities/user-project.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { AuditService } from '../common/audit.service';

@Injectable()
export class UserProjectsService {
  constructor(
    @InjectRepository(UserProject) private userProjectsRepo: Repository<UserProject>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    private auditService: AuditService,
  ) {}

  /**
   * IDs de los proyectos a los que un usuario está restringido.
   * Array VACÍO significa "sin restricción" (acceso global) — así
   * ningún usuario existente pierde acceso por accidente al agregar
   * esta función.
   */
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
}
