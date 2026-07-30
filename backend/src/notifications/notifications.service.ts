import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
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

  async send(params: {
    to: string;
    subject: string;
    body: string;
    relatedDocumentId?: string;
  }) {
    let status: NotificationStatus = NotificationStatus.SIMULADO;

    if (this.smtpConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || 'sst@etinar.com',
          to: params.to,
          subject: params.subject,
          text: params.body,
        });
        status = NotificationStatus.ENVIADO;
      } catch (err) {
        this.logger.error(`Error enviando correo a ${params.to}: ${err}`);
        status = NotificationStatus.ERROR;
      }
    }

    return this.notificationsRepo.save(
      this.notificationsRepo.create({
        recipientEmail: params.to,
        subject: params.subject,
        body: params.body,
        relatedDocumentId: params.relatedDocumentId,
        status,
      }),
    );
  }

  findAll(limit = 200) {
    return this.notificationsRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
