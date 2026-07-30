import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
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
