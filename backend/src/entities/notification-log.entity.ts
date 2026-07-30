import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationStatus {
  ENVIADO = 'enviado', // SMTP configurado y envío exitoso
  SIMULADO = 'simulado', // sin SMTP configurado, solo quedó registrado
  ERROR = 'error',
}

@Entity('notification_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipientEmail: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  relatedDocumentId: string;

  @Column({ type: 'varchar' })
  status: NotificationStatus;

  @CreateDateColumn()
  createdAt: Date;
}
