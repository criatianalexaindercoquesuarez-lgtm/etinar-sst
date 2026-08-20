import { Injectable, NotFoundException, GoneException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UploadLink } from '../entities/upload-link.entity';
import { Contractor } from '../entities/contractor.entity';
import { AuditService } from '../common/audit.service';

@Injectable()
export class UploadLinksService {
  constructor(
    @InjectRepository(UploadLink) private linksRepo: Repository<UploadLink>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    private auditService: AuditService,
  ) {}

  async create(contractorId: string, actingUser: any, expiresInDays?: number) {
    const contractor = await this.contractorsRepo.findOne({ where: { id: contractorId } });
    if (!contractor) throw new NotFoundException('Contratista no encontrado');

    const token = crypto.randomBytes(24).toString('base64url'); // ~32 caracteres, URL-safe
    const link = this.linksRepo.create({
      token,
      contractor,
      createdBy: { id: actingUser.userId } as any,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    });
    const saved = await this.linksRepo.save(link);

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: 'UPLOAD_LINK_CREATE',
      entityType: 'UploadLink',
      entityId: saved.id,
      details: `Enlace de recepción creado para ${contractor.legalName}`,
    });

    return saved;
  }

  findByContractor(contractorId: string) {
    return this.linksRepo.find({
      where: { contractor: { id: contractorId } },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string, actingUser: any) {
    const link = await this.linksRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Enlace no encontrado');
    link.active = false;
    await this.linksRepo.save(link);
    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: 'UPLOAD_LINK_REVOKE',
      entityType: 'UploadLink',
      entityId: link.id,
    });
    return link;
  }

  /**
   * Valida un token público y devuelve el enlace con su contratista.
   * Lanza NotFound si el token no existe, o Gone si está revocado/expirado
   * (código HTTP 410, semánticamente correcto para "ya no disponible").
   */
  async validateToken(token: string): Promise<UploadLink> {
    const link = await this.linksRepo.findOne({
      where: { token },
      relations: { contractor: true },
    });
    if (!link) throw new NotFoundException('Enlace no válido');
    if (!link.active) throw new GoneException('Este enlace fue desactivado');
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      throw new GoneException('Este enlace expiró');
    }
    return link;
  }

  async registerUse(linkId: string) {
    await this.linksRepo.increment({ id: linkId }, 'useCount', 1);
    await this.linksRepo.update(linkId, { lastUsedAt: new Date() });
  }
}
