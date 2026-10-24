/**
 * Cria (ou atualiza a senha de) o professor. Não existe cadastro público.
 *
 *   pnpm api:create-teacher --name "Filipe" --email voce@email.com --password "senha-forte"
 *
 * Sem argumentos, usa DEV_TEACHER_* do .env (somente fora de produção).
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PASSWORD_MIN_LENGTH } from '@turmei/contracts';
import { AppModule } from '../app.module';
import { TeachersService } from '../professor/teachers.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const devDefaults = process.env.NODE_ENV !== 'production';
  const name = arg('name') ?? (devDefaults ? process.env.DEV_TEACHER_NAME : undefined);
  const email = arg('email') ?? (devDefaults ? process.env.DEV_TEACHER_EMAIL : undefined);
  const password = arg('password') ?? (devDefaults ? process.env.DEV_TEACHER_PASSWORD : undefined);
  if (!name || !email || !password) {
    console.error('Uso: pnpm api:create-teacher --name "Nome" --email email --password senha');
    process.exit(1);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const { teacher, created } = await app.get(TeachersService).upsert(name, email, password);
  console.log(`${created ? 'Professor criado' : 'Professor atualizado'}: ${teacher.name} <${teacher.email}>`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
