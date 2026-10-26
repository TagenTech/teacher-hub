import { expect, test, type Page } from '@playwright/test';

/**
 * Os fluxos principais no celular, como a professora usa:
 * criar conta → cadastrar aluno → agendar e marcar aula → receber pagamento → relatórios → lembretes → sair e entrar.
 * Uma conta nova por execução; os passos rodam em ordem na mesma aba.
 */
test.describe.configure({ mode: 'serial' });

const PROFESSORA = { name: 'Paula Playwright', email: `paula+${Date.now()}@turmei.test`, password: 'senha-forte-123' };
const ALUNA = 'Bruna Teste';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** O cartão da aula das 23h na tela Hoje (a aluna também aparece em "Pagamentos"). */
const lessonCard = () => page.getByRole('button').filter({ hasText: '23:00' }).filter({ hasText: ALUNA });

/** Data de hoje no fuso do navegador (America/Sao_Paulo), em YYYY-MM-DD. */
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

test('cria a conta e entra direto no app', async () => {
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill(PROFESSORA.name);
  await page.getByLabel('E-mail').fill(PROFESSORA.email);
  await page.getByLabel('Senha', { exact: true }).fill(PROFESSORA.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByRole('heading', { name: /Paula/ })).toBeVisible();
});

test('cadastra uma aluna com plano mensal', async () => {
  await page.goto('/alunos/novo');
  await page.getByLabel('Nome completo').fill(ALUNA);
  await page.getByLabel('WhatsApp', { exact: true }).fill('11987654321');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Passo 2 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Passo 3 de 3')).toBeVisible();

  await page.getByRole('radiogroup', { name: 'Tipo de cobrança' }).getByRole('radio', { name: /Mensal/ }).click();
  await page.getByLabel('Valor da mensalidade').fill('250,00');
  await page.getByRole('radio', { name: 'Dia 10' }).click();
  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();

  await expect(page).toHaveURL(/\/alunos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: ALUNA })).toBeVisible();

  await page.goto('/alunos');
  await expect(page.getByText(ALUNA)).toBeVisible();
});

test('aluno de outro país: WhatsApp com + e código do país', async () => {
  await page.goto('/alunos/novo');
  await page.getByLabel('Nome completo').fill('Emma Online');
  const phone = page.getByLabel('WhatsApp', { exact: true });
  await phone.fill('+44 7911 123456');
  await expect(phone).toHaveValue('+44 791 112 3456');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radiogroup', { name: 'Tipo de cobrança' }).getByRole('radio', { name: /Por aula/ }).click();
  await page.getByLabel('Valor de cada aula').fill('90,00');
  await page.getByRole('radio', { name: 'Dia 10' }).click();
  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();

  await expect(page).toHaveURL(/\/alunos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Emma Online' })).toBeVisible();
  await expect(page.getByText('+44 791 112 3456')).toBeVisible();
  await expect(page.locator('a[href="https://wa.me/447911123456"]').first()).toBeVisible();
});

test('número com formato errado mostra o aviso e não cadastra', async () => {
  await page.goto('/alunos/novo');
  await page.getByLabel('Nome completo').fill('Teste Inválido');
  await page.getByLabel('WhatsApp', { exact: true }).fill('+1415');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText(/ou \+ e o código do país/)).toBeVisible();
  await expect(page.getByText('Passo 1 de 3')).toBeVisible();
});

test('agenda uma aula para hoje e marca como realizada', async () => {
  await page.goto('/hoje');
  await page.getByRole('button', { name: 'Ações rápidas' }).click();
  await page.getByText('Nova aula', { exact: true }).click();

  const sheet = page.getByRole('dialog', { name: 'Nova aula' });
  await sheet.getByRole('radio', { name: new RegExp(ALUNA) }).click();
  await sheet.getByLabel('Dia').fill(todayIso());
  await sheet.getByLabel('Horário').fill('23:00');
  await sheet.getByRole('button', { name: 'Agendar aula' }).click();
  await expect(sheet).toBeHidden();

  await page.goto('/hoje');
  await lessonCard().click();
  await page.getByRole('button', { name: '✓ Aula realizada' }).click();
  await expect(page.getByText('Aula realizada ✓')).toBeVisible();

  // Reabrindo, a aula já aparece marcada (com opção de desfazer).
  await lessonCard().click();
  await expect(page.getByRole('button', { name: /Desfazer marcação/ })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('recebe o pagamento da mensalidade no financeiro', async () => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: new RegExp(ALUNA) }).first().click();
  await page.getByRole('button', { name: 'Recebi' }).click();
  await expect(page.getByLabel('Valor recebido')).toHaveValue(/250,00/);
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();

  await expect(page.getByText(/Pago/).first()).toBeVisible();
});

test('relatórios mostram o que entrou', async () => {
  await page.goto('/relatorios');
  await expect(page.getByText('R$ 250,00').first()).toBeVisible();
});

test('lembretes oferecem o calendário do celular', async () => {
  await page.goto('/mais/lembretes');
  await expect(page.getByText(/Google Agenda/).first()).toBeVisible();
});

test('sai e entra de novo com e-mail e senha', async () => {
  await page.goto('/mais');
  await page.getByRole('button', { name: /^Sair/ }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('E-mail').fill(PROFESSORA.email);
  await page.getByLabel('Senha', { exact: true }).fill(PROFESSORA.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText(ALUNA).first()).toBeVisible();
});
