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

  // Si el usuario pertenece a un contratista (portal del contratista)
  @ManyToOne(() => Contractor, { nullable: true })
  contractor: Contractor;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
