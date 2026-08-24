import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Document } from './document.entity';
import { Project } from './project.entity';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'warning' })
  type: string;

  @Column({ default: false })
  isRead: boolean;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'CASCADE' })
  document: Document;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;
}
