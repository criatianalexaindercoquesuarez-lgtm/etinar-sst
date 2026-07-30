import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Document, DocumentStatus } from '../entities/document.entity';
import { Contractor, ContractorStatus } from '../entities/contractor.entity';
import { Worker } from '../entities/worker.entity';
import { Alert, AlertType } from '../entities/alert.entity';
import {
  SanctionRule,
  SanctionTrigger,
  SanctionAction,
} from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';
import { User, UserRole } from '../entities/user.entity';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

// Hitos de aviso previo, en días restantes hasta el vencimiento.
const ALERT_MILESTONES = [30, 15, 7, 3, 1, 0];

@Injectable()
export class ComplianceEngineService {
  private readonly logger = new Logger(ComplianceEngineService.name);

  constructor(
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Worker) private workersRepo: Repository<Worker>,
    @InjectRepository(Alert) private alertsRepo: Repository<Alert>,
    @InjectRepository(SanctionRule) private rulesRepo: Repository<SanctionRule>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Job programado: corre todos los días a la 1:00 AM.
   * Revisa TODA la base documental y aplica las reglas de negocio
   * sin intervención manual, tal como especifica el flujo de estados:
   * aprobado -> por vencer -> vencido -> suspendido -> bloqueado
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyCron() {
    this.logger.log('Ejecutando revisión diaria automática de cumplimiento...');
    const result = await this.runDailyCheck();
    this.logger.log(
      `Revisión completa: ${result.transitioned.length} documentos actualizados, ` +
        `${result.alertsCreated} alertas, ${result.notificationsSent} notificaciones, ` +
        `${result.sanctionsApplied} sanciones aplicadas.`,
    );
    return result;
  }

  /**
   * Lógica completa del motor. Expuesta también como endpoint on-demand
   * (para pruebas y para que un administrador pueda forzar la revisión).
   */
  async runDailyCheck() {
    const transitioned: string[] = [];
    let alertsCreated = 0;
    let notificationsSent = 0;
    let sanctionsApplied = 0;

    const notifyRecipients = await this.getResponsibleEmails();

    // 1) Documentos aprobados o "por vencer" con fecha de vencimiento
    const candidates = await this.documentsRepo.find({
      where: [
        { status: DocumentStatus.APROBADO },
        { status: DocumentStatus.POR_VENCER },
      ],
      relations: { documentType: true, contractor: true, project: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const doc of candidates) {
      if (!doc.dueDate) continue;
      const due = new Date(doc.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);

      if (daysLeft < 0) {
        // Vencido: transición automática + alerta diaria mientras siga vencido
        if (doc.status !== DocumentStatus.VENCIDO) {
          doc.status = DocumentStatus.VENCIDO;
          doc.requiresRenewal = true;
          await this.documentsRepo.save(doc);
          transitioned.push(doc.id);
        }
        await this.createAlertAndNotify(
          doc,
          AlertType.DOCUMENTO_VENCIDO,
          `Documento "${doc.documentType?.name}" de ${doc.contractor?.legalName} está VENCIDO hace ${Math.abs(daysLeft)} día(s).`,
          notifyRecipients,
        );
        alertsCreated++;
        notificationsSent += notifyRecipients.length;

        // Aplicar reglas de sanción configuradas para "documento_vencido"
        sanctionsApplied += await this.applySanctions(
          SanctionTrigger.DOCUMENTO_VENCIDO,
          doc,
        );
      } else if (ALERT_MILESTONES.includes(daysLeft)) {
        // Por vencer: transición automática al entrar en la ventana de 30 días
        if (daysLeft <= 30 && doc.status !== DocumentStatus.POR_VENCER) {
          doc.status = DocumentStatus.POR_VENCER;
          await this.documentsRepo.save(doc);
          transitioned.push(doc.id);
        }
        const label = daysLeft === 0 ? 'vence HOY' : `vence en ${daysLeft} día(s)`;
        await this.createAlertAndNotify(
          doc,
          AlertType.DOCUMENTO_POR_VENCER,
          `Documento "${doc.documentType?.name}" de ${doc.contractor?.legalName} ${label}.`,
          notifyRecipients,
        );
        alertsCreated++;
        notificationsSent += notifyRecipients.length;
      }
    }

    return { transitioned, alertsCreated, notificationsSent, sanctionsApplied };
  }

  private async createAlertAndNotify(
    doc: Document,
    type: AlertType,
    message: string,
    recipients: string[],
  ) {
    await this.alertsRepo.save(this.alertsRepo.create({ type, document: doc, message }));

    const subject = `[SST ETINAR] ${message.split('.')[0]}`;
    for (const email of recipients) {
      await this.notificationsService.send({
        to: email,
        subject,
        body: `${message}\n\nProyecto: ${doc.project?.code ?? ''}\nContratista: ${doc.contractor?.legalName ?? ''}\n\nEste es un mensaje automático del Sistema SST ETINAR.`,
        relatedDocumentId: doc.id,
      });
    }
    // También notificar directamente al correo del contratista afectado
    if (doc.contractor?.email && !recipients.includes(doc.contractor.email)) {
      await this.notificationsService.send({
        to: doc.contractor.email,
        subject,
        body: `${message}\n\nPor favor ingrese al portal para regularizar la documentación.`,
        relatedDocumentId: doc.id,
      });
    }
  }

  private async getResponsibleEmails(): Promise<string[]> {
    const users = await this.usersRepo.find({
      where: [{ role: UserRole.COORDINADOR_SST }, { role: UserRole.ADMIN }],
    });
    return users.map((u) => u.email);
  }

  /**
   * Evalúa las reglas de sanción activas para un disparador dado y las aplica
   * automáticamente: multa, bloqueo de trabajador, bloqueo de empresa,
   * suspensión o denegación de ingreso. No requiere intervención manual.
   */
  private async applySanctions(
    trigger: SanctionTrigger,
    doc: Document,
  ): Promise<number> {
    const rules = await this.rulesRepo.find({
      where: { trigger, active: true },
    });
    let applied = 0;

    for (const rule of rules) {
      // Días de gracia: no sancionar si aún no se cumple el periodo configurado
      if (rule.gracePeriodDays && doc.dueDate) {
        const due = new Date(doc.dueDate);
        const graceEnds = new Date(due.getTime() + rule.gracePeriodDays * 86400000);
        if (new Date() < graceEnds) continue;
      }

      const contractor = doc.contractor;
      const reason = `Regla automática: ${rule.description || rule.trigger} → ${rule.action} (documento: ${doc.id})`;

      // Evitar duplicar la misma sanción para el mismo documento+regla
      const existing = await this.sanctionsRepo.findOne({
        where: {
          rule: { id: rule.id },
          document: { id: doc.id },
          contractor: { id: contractor.id },
        },
      });
      if (existing) continue;

      await this.sanctionsRepo.save(
        this.sanctionsRepo.create({ rule, contractor, document: doc, reason }),
      );
      applied++;

      switch (rule.action) {
        case SanctionAction.BLOQUEO_EMPRESA:
          contractor.status = ContractorStatus.BLOQUEADO;
          contractor.blockReason = reason;
          await this.contractorsRepo.save(contractor);
          break;
        case SanctionAction.SUSPENSION:
          contractor.status = ContractorStatus.SUSPENDIDO;
          contractor.blockReason = reason;
          await this.contractorsRepo.save(contractor);
          break;
        case SanctionAction.BLOQUEO_TRABAJADOR:
        case SanctionAction.DENEGAR_INGRESO: {
          const workers = await this.workersRepo.find({
            where: { contractor: { id: contractor.id } },
          });
          for (const w of workers) {
            w.blocked = true;
            w.blockReason = reason;
            await this.workersRepo.save(w);
          }
          break;
        }
        case SanctionAction.MULTA:
          // La multa queda registrada como Sanction (con su regla y monto);
          // no cambia el estado del contratista por sí sola.
          break;
      }

      await this.auditService.log({
        action: 'SANCTION_APPLIED',
        entityType: 'Document',
        entityId: doc.id,
        details: reason,
      });
    }

    return applied;
  }
}
