import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Contenido binario de los archivos cargados, guardado en la propia base de
 * datos (PostgreSQL/Supabase). Es el almacenamiento permanente por defecto
 * cuando Cloudflare R2 no está configurado: no depende del disco del
 * servidor (que en Render se borra al reiniciar) ni de credenciales extra.
 *
 * Se guarda en una tabla separada para que listar documentos/versiones
 * nunca cargue los bytes de los archivos.
 */
@Entity('stored_files')
export class StoredFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: process.env.DATABASE_URL ? 'bytea' : 'blob' })
  data: Buffer;

  @Column({ type: 'varchar' })
  contentType: string;

  @Column({ type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'varchar' })
  sha256: string;

  @CreateDateColumn()
  createdAt: Date;
}
