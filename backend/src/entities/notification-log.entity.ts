import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationStatus {
  ENVIADO = 'enviado',
  SIMULADO = 'simulado',
  ERROR = 'error',
}

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  recipient: User;

  @Column()
  recipientEmail: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: 'email' })
  channel: string;

  @Column({ default: 'sent' })
  status: NotificationStatus | string;

  @Column({ type: 'text', nullable: true })
  errorDetails: string;

  @CreateDateColumn()
  createdAt: Date;
}
