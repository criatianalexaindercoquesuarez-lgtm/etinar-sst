import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum SanctionTrigger {
  DOCUMENTO_VENCIDO = 'documento_vencido',
  DOCUMENTO_NO_CARGADO = 'documento_no_cargado',
  OBSERVACION_NO_CORREGIDA = 'observacion_no_corregida',
  EXAMEN_MEDICO_VENCIDO = 'examen_medico_vencido',
  CAPACITACION_VENCIDA = 'capacitacion_vencida',
}

export enum SanctionAction {
  MULTA = 'multa',
  BLOQUEO_TRABAJADOR = 'bloqueo_trabajador',
  BLOQUEO_EMPRESA = 'bloqueo_empresa',
  SUSPENSION = 'suspension',
  DENEGAR_INGRESO = 'denegar_ingreso',
}

/**
 * Regla configurable desde el panel administrativo:
 * "cuando ocurra <trigger>, aplicar <action>".
 * El motor de cumplimiento evalúa estas reglas automáticamente,
 * sin intervención manual.
 */
@Entity('sanction_rules')
export class SanctionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  trigger: SanctionTrigger;

  @Column({ type: 'varchar' })
  action: SanctionAction;

  @Column({ nullable: true })
  fineAmount: number; // monto de la multa, si action = multa

  @Column({ nullable: true })
  gracePeriodDays: number; // días de gracia antes de aplicar la sanción

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
