import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // La carpeta de archivos cargados debe existir ANTES de que el servidor
  // reciba la primera carga. No depende de que Git haya versionado una
  // carpeta vacía (Git no puede) — se crea aquí en cada arranque,
  // de forma idempotente (no falla si ya existe).
  const uploadsDir = join(process.cwd(), 'src', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Carpeta de cargas creada: ${uploadsDir}`);
  }

  const app = await NestFactory.create(AppModule);

  // En desarrollo, permite cualquier origen. En producción, configura
  // FRONTEND_URL con la URL pública real del frontend (Render, Vercel, etc.)
  // para restringir el acceso solo a tu propia app.
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ? [frontendUrl] : true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Sistema SST ETINAR — backend corriendo en http://localhost:${port}/api`);
}
bootstrap();
