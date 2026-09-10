import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Contractor } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Project } from '../entities/project.entity';
import { User, UserRole } from '../entities/user.entity';
import { AuditService } from '../common/audit.service';
import { UserProjectsService } from '../user-projects/user-projects.service';

function generateTemporaryPassword(): string {
  const words = ['sst', 'obra', 'forja', 'nexo', 'ancla', 'faro', 'cima', 'vega'];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = crypto.randomInt(1000, 9999);
  return `${w1}-${w2}-${num}`;
}

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private auditService: AuditService,
    private userProjectsService: UserProjectsService,
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

  /**
   * Un usuario interno SIN restricción de proyecto ve todos los
   * contratistas (comportamiento histórico). Uno CON proyectos
   * asignados solo ve los contratistas que participan en esos proyectos.
   */
  async findAll(actingUser?: any) {
    if (actingUser?.userId) {
      const restrictedIds = await this.userProjectsService.getAssignedProjectIds(actingUser.userId);
      if (restrictedIds.length > 0) {
        const links = await this.contractorProjectsRepo.find({
          where: { project: { id: In(restrictedIds) } },
          relations: { contractor: true },
        });
        const uniqueIds = [...new Set(links.map((l) => l.contractor.id))];
        if (uniqueIds.length === 0) return [];
        return this.contractorsRepo.find({
          where: { id: In(uniqueIds) },
          order: { createdAt: 'DESC' },
        });
      }
    }
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

  // ---------- Gestión de accesos de portal ----------

  async createPortalUser(
    contractorId: string,
    data: { email: string; fullName: string },
    actingUser: any,
  ) {
    const contractor = await this.findOne(contractorId);
    const existing = await this.usersRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);

    const user = this.usersRepo.create({
      email: data.email,
      fullName: data.fullName,
      role: UserRole.CONTRATISTA,
      password: hash,
      contractor,
    });
    const saved = await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'PORTAL_USER_CREATE',
      entityType: 'User',
      entityId: saved.id,
      details: `Acceso creado para ${contractor.legalName}: ${data.email}`,
    });

    return {
      user: { id: saved.id, email: saved.email, fullName: saved.fullName, active: saved.active },
      temporaryPassword,
    };
  }

  async listPortalUsers(contractorId: string) {
    return this.usersRepo.find({
      where: { contractor: { id: contractorId } },
      select: { id: true, email: true, fullName: true, active: true, createdAt: true },
    });
  }

  async resetPortalUserPassword(userId: string, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const temporaryPassword = generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, 10);
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'PORTAL_USER_RESET_PASSWORD',
      entityType: 'User',
      entityId: user.id,
    });

    return { temporaryPassword };
  }

  async togglePortalUserActive(userId: string, active: boolean, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.active = active;
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: active ? 'PORTAL_USER_ENABLE' : 'PORTAL_USER_DISABLE',
      entityType: 'User',
      entityId: user.id,
    });

    return { id: user.id, active: user.active };
  }
}
