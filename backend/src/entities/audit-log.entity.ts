import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

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
  status: string;

  @Column({ type: 'text', nullable: true })
  errorDetails: string;

  @CreateDateColumn()
  createdAt: Date;
}
