import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Contractor } from './contractor.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  idNumber: string; // cédula

  @Column()
  position: string;

  @ManyToOne(() => Contractor, (c) => c.workers, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  blocked: boolean; // deniega el ingreso a obra

  @Column({ type: 'text', nullable: true })
  blockReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
