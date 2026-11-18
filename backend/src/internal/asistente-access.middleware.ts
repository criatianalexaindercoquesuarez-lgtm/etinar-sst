import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/constants';

/**
 * Los usuarios con rol "asistente" (personal SST/Ambiente/Médico/Social de
 * ETINAR) solo pueden usar el módulo DOCUMENTACIÓN INTERNA y su propia sesión.
 * Se bloquea por defecto cualquier otra ruta de la API (contratistas,
 * revisión documental, sanciones, etc.), sin tener que modificar cada módulo.
 */
const ALLOWED = [/^\/api\/internal(\/|$)/, /^\/api\/auth(\/|$)/];

@Injectable()
export class AsistenteAccessMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return next();
    try {
      const payload: any = jwt.verify(header.slice(7), JWT_SECRET);
      const url = (req.originalUrl || req.url).split('?')[0];
      if (payload?.role === 'asistente' && !ALLOWED.some((r) => r.test(url))) {
        res.status(403).json({ statusCode: 403, message: 'Su usuario solo tiene acceso a Documentación Interna ETINAR' });
        return;
      }
    } catch {
      /* token inválido: lo resuelve el guard de autenticación */
    }
    next();
  }
}
