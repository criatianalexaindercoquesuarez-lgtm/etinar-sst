import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Contractor } from './contractor.entity';
import { User } from './user.entity';

/**
 * Enlace personalizado de recepción documental: permite a un contratista
 * subir documentos SIN necesidad de usuario/contraseña, mediante un token
 * largo y aleatorio en la URL. Alternativa al acceso por login, tal como
 * contempla el flujo original ("usuario, contraseña, o enlace personalizado").
 *
 * El token es el único mecanismo de seguridad: no adivinable (32+ caracteres
 * aleatorios), revocable en cualquier momento, y opcionalmente con fecha de
 * expiración.
 */
@Entity('upload_links')
export class UploadLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @ManyToOne(() => Contractor, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt: Date;

  @Column({ default: 0 })
  useCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
