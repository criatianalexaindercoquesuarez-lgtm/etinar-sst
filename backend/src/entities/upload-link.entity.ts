import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Contractor } from './contractor.entity';

@Entity('upload_links')
export class UploadLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @ManyToOne(() => Contractor, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;
@Column({ type: 'int', default: 0 })
  useCount: number;
  @CreateDateColumn()
  createdAt: Date;
}
