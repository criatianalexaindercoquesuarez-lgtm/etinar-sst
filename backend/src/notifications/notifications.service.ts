import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { GraphAuthService } from '../sharepoint/graph-auth.service';
import {
  NotificationLog,
  NotificationStatus,
} from '../entities/notification-log.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly smtpConfigured: boolean;

  constructor(
    @InjectRepository(NotificationLog)
    private notificationsRepo: Repository<NotificationLog>,
    private graphAuth: GraphAuthService,
  ) {
    // El envío real de correo requiere credenciales SMTP configuradas
    // como variables de entorno. Sin ellas, el sistema sigue funcionando
    // pero deja el correo "simulado" registrado en la bitácora, para que
    // nada del flujo de negocio dependa de tener SMTP conectado.
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    this.smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

    if (this.smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      this.logger.log('SMTP configurado — los correos se enviarán realmente.');
    } else {
      this.logger.warn(
        'SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). ' +
          'Los correos quedarán registrados como "simulados" en notification_log.',
      );
    }
  }

  /**
   * Canal de salida:
   *  1. SMTP (si SMTP_HOST/SMTP_USER/SMTP_PASS están configurados)
   *  2. Microsoft 365 vía Graph (si Azure AD está configurado y MAIL_SENDER
   *     indica el buzón remitente, ej. sst@etinar.com — permiso Mail.Send)
   *  3. "simulado": queda registrado en notification_log
   */
  get channel(): 'smtp' | 'graph' | 'simulado' {
    if (this.smtpConfigured) return 'smtp';
    if (this.graphAuth.configured && process.env.MAIL_SENDER) return 'graph';
    return 'simulado';
  }

  async send(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
    relatedDocumentId?: string;
  }) {
    let status: NotificationStatus = NotificationStatus.SIMULADO;
    let errorDetails: string | undefined;
    const recipients = params.to
      .split(/[;,]/)
      .map((r) => r.trim())
      .filter(Boolean);

    if (this.smtpConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || 'sst@etinar.com',
          to: recipients.join(', '),
          subject: params.subject,
          text: params.body,
          html: params.html,
          attachments: params.attachments,
        });
        status = NotificationStatus.ENVIADO;
      } catch (err) {
        this.logger.error(`Error enviando correo a ${params.to}: ${err}`);
        status = NotificationStatus.ERROR;
        errorDetails = String(err);
      }
    } else if (this.channel === 'graph') {
      try {
        await this.sendViaGraph(recipients, params);
        status = NotificationStatus.ENVIADO;
      } catch (err) {
        this.logger.error(`Error enviando correo (Microsoft 365) a ${params.to}: ${err}`);
        status = NotificationStatus.ERROR;
        errorDetails = String(err);
      }
    }

    return this.notificationsRepo.save(
      this.notificationsRepo.create({
        recipientEmail: recipients.join(', '),
        subject: params.subject,
        body: params.body,
        relatedDocumentId: params.relatedDocumentId,
        status,
        errorDetails,
      }),
    );
  }

  private async sendViaGraph(
    to: string[],
    params: { subject: string; body: string; html?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] },
  ) {
    const token = await this.graphAuth.getAccessToken();
    if (!token) throw new Error('Sin token de Microsoft 365');
    const from = process.env.MAIL_SENDER!;
    const res = await fetch(`${this.graphAuth.baseUrl}/users/${encodeURIComponent(from)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: params.html
            ? { contentType: 'HTML', content: params.html }
            : { contentType: 'Text', content: params.body },
          toRecipients: to.map((address) => ({ emailAddress: { address } })),
          attachments: (params.attachments || []).map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentType: a.contentType,
            contentBytes: a.content.toString('base64'),
          })),
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) throw new Error(`Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  findAll(limit = 200) {
    return this.notificationsRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
