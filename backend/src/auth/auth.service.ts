import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { AuditService } from '../common/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { email },
      relations: { contractor: true },
      select: {
        id: true,
        email: true,
        password: true,
        fullName: true,
        role: true,
        active: true,
        contractor: { id: true },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      contractorId: user.contractor?.id ?? null,
    };
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        contractorId: user.contractor?.id ?? null,
      },
    };
  }

  /**
   * Permite a CUALQUIER usuario autenticado (Admin, Coordinador SST,
   * Director, Contratista) cambiar su propia contraseña, verificando
   * primero la contraseña actual. No requiere rol especial: cada quien
   * gestiona la suya.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      action: 'PASSWORD_CHANGE_SELF',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: true };
  }
}
