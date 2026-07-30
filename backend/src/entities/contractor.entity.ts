import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContractorProject } from './contractor-project.entity';
import { Worker } from './worker.entity';

export enum ContractorStatus {
  ACTIVO = 'activo',
  SUSPENDIDO = 'suspendido',
  BLOQUEADO = 'bloqueado',
  INACTIVO = 'inactivo',
}

@Entity('contractors')
export class Contractor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  legalName: string;

  @Column()
  legalRepresentative: string;

  @Column({ unique: true })
  ruc: string;

  @Column({ nullable: true })
  address: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'varchar', default: ContractorStatus.ACTIVO })
  status: ContractorStatus;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'text', nullable: true })
  blockReason: string; // motivo mostrado cuando status = bloqueado o suspendido

  @OneToMany(() => ContractorProject, (cp) => cp.contractor)
  contractorProjects: ContractorProject[];

  @OneToMany(() => Worker, (w) => w.contractor)
  workers: Worker[];

  @CreateDateColumn()
  createdAt: Date;
}
