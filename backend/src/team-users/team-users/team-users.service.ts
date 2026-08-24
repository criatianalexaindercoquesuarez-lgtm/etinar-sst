import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserRole } from '../entities/user.entity';
import { AuditService } from '../common/audit.service';

const INTERNAL_ROLES = [UserRole.ADMIN, UserRole.COORDINADOR_SST, UserRole.DIRECTOR];

function generateTemporaryPassword(): string {
  const words = ['sst', 'obra', 'forja', 'nexo', 'ancla', 'faro', 'cima', 'vega'];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = crypto.randomInt(1000, 9999);
  return `${w1}-${w2}-${num}`;
}

@Injectable()
export class TeamUsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private auditService: AuditService,
  ) {}

  /**
   * Crea un miembro del equipo interno de ETINAR (no un contratista).
   * Ej: un ayudante que necesita revisar/aprobar documentación y dar
   * seguimiento al cumplimiento, sin ser necesariamente Admin.
   */
  async create(
    data: { email: string; fullName: string; role: UserRole },
    actingUser: any,
  ) {
    if (!INTERNAL_ROLES.includes(data.role)) {
      throw new BadRequestException(
        'Rol no válido para equipo interno (usa admin, coordinador_sst o director)',
      );
    }
    const existing = await this.usersRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);

    const user = this.usersRepo.create({
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      password: hash,
    });
    const saved = await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: 'TEAM_USER_CREATE',
      entityType: 'User',
      entityId: saved.id,
      details: `${data.fullName} (${data.email}) — rol: ${data.role}`,
    });

    return {
      user: {
        id: saved.id,
        email: saved.email,
        fullName: saved.fullName,
        role: saved.role,
        active: saved.active,
      },
      temporaryPassword,
    };
  }

  async findAll() {
    const users = await this.usersRepo.find({
      where: [
        { role: UserRole.ADMIN },
        { role: UserRole.COORDINADOR_SST },
        { role: UserRole.DIRECTOR },
      ],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    return users;
  }

  async resetPassword(userId: string, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const temporaryPassword = generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, 10);
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: 'TEAM_USER_RESET_PASSWORD',
      entityType: 'User',
      entityId: user.id,
    });

    return { temporaryPassword };
  }

  async toggleActive(userId: string, active: boolean, actingUser: any) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (userId === actingUser.userId && !active) {
      throw new BadRequestException('No puedes deshabilitar tu propia cuenta');
    }

    user.active = active;
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: active ? 'TEAM_USER_ENABLE' : 'TEAM_USER_DISABLE',
      entityType: 'User',
      entityId: user.id,
    });

    return { id: user.id, active: user.active };
  }

  async updateRole(userId: string, role: UserRole, actingUser: any) {
    if (!INTERNAL_ROLES.includes(role)) {
      throw new BadRequestException('Rol no válido');
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.role = role;
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: 'TEAM_USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: user.id,
      details: `Nuevo rol: ${role}`,
    });

    return { id: user.id, role: user.role };
  }
}
