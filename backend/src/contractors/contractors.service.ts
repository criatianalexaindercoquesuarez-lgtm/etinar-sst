import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Contractor } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Project } from '../entities/project.entity';
import { User, UserRole } from '../entities/user.entity';
import { AuditService } from '../common/audit.service';

// Genera una contraseña temporal legible y suficientemente segura,
// ej. "sst-forja-4821", para compartir fácilmente con el contratista.
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

  /**
   * Crea el acceso al portal para un contratista real: un usuario con rol
   * "contratista" ligado a esa empresa. Genera una contraseña temporal si
   * no se especifica una. La contraseña en texto plano solo se devuelve
   * UNA VEZ en la respuesta de este método — nunca se puede recuperar
   * después (queda solo el hash), así que el admin debe copiarla y
   * compartirla con el contratista de inmediato.
   */
  async createPortalUser(
    contractorId: string,
    data: { email: string; fullName: string; password?: string },
    actingUser: any,
  ) {
    const contractor = await this.findOne(contractorId);

    const existing = await this.usersRepo.findOne({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario registrado con ese correo');
    }

    const plainPassword = data.password || generateTemporaryPassword();
    const hash = await bcrypt.hash(plainPassword, 10);

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email: data.email,
        fullName: data.fullName,
        password: hash,
        role: UserRole.CONTRATISTA,
        contractor,
      }),
    );

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'CONTRACTOR_PORTAL_USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      details: `Acceso de portal creado para ${data.email} (${contractor.legalName})`,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        active: user.active,
      },
      temporaryPassword: plainPassword,
    };
  }

  async listPortalUsers(contractorId: string) {
    await this.findOne(contractorId);
    return this.usersRepo.find({
      where: { contractor: { id: contractorId } },
      select: { id: true, email: true, fullName: true, active: true, createdAt: true },
    });
  }

  async resetPortalUserPassword(userId: string, actingUser: any) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { contractor: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const plainPassword = generateTemporaryPassword();
    user.password = await bcrypt.hash(plainPassword, 10);
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'CONTRACTOR_PORTAL_PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
      details: `Contraseña reiniciada para ${user.email}`,
    });

    return { email: user.email, temporaryPassword: plainPassword };
  }

  async togglePortalUserActive(userId: string, active: boolean, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.active = active;
    await this.usersRepo.save(user);
    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: active ? 'CONTRACTOR_PORTAL_USER_ENABLED' : 'CONTRACTOR_PORTAL_USER_DISABLED',
      entityType: 'User',
      entityId: user.id,
    });
    return { id: user.id, active: user.active };
  }
}
