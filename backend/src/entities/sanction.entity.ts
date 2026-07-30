import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { SanctionRule } from './sanction-rule.entity';
import { Contractor } from './contractor.entity';
import { Worker } from './worker.entity';
import { Document } from './document.entity';

@Entity('sanctions')
export class Sanction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SanctionRule)
  rule: SanctionRule;

  @ManyToOne(() => Contractor, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @ManyToOne(() => Worker, { nullable: true, onDelete: 'CASCADE' })
  worker: Worker;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'SET NULL' })
  document: Document;

  @Column({ type: 'text' })
  reason: string;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  appliedAt: Date;
}
