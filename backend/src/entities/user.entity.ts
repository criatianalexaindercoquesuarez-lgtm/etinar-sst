import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Contractor } from './contractor.entity';

export enum UserRole {
  ADMIN = 'admin',
  COORDINADOR_SST = 'coordinador_sst',
  DIRECTOR = 'director',
  CONTRATISTA = 'contratista',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  fullName: string;

  @Column({ type: 'varchar', default: UserRole.CONTRATISTA })
  role: UserRole;

  // Cargo/puesto de trabajo, libre — solo informativo, NO determina permisos.
  // Ej: "Asistente de Talento Humano", "Técnico de Seguridad". Los permisos
  // reales los da el campo "role" de arriba (admin/coordinador_sst/director).
  @Column({ nullable: true })
  jobTitle?: string;

  @ManyToOne(() => Contractor, { nullable: true })
  contractor: Contractor;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
