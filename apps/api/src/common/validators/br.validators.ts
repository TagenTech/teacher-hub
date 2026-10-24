import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { isIsoDate, isValidPhone, normalizePhone } from '@turmei/contracts';

/** '' e espaços viram null — o formulário manda campo vazio para "apagar". */
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/** Aceita qualquer máscara e guarda só os dígitos; valida celular/fixo BR. */
export function IsBrPhone(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    Transform(({ value }) =>
      typeof value === 'string' ? (value.trim() ? normalizePhone(value) : null) : value,
    )(target, propertyName);
    registerDecorator({
      name: 'isBrPhone',
      target: target.constructor,
      propertyName,
      options: { message: 'Telefone inválido — use DDD + número', ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && isValidPhone(v) },
    });
  };
}

export function IsIsoDate(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isIsoDate',
      target: target.constructor,
      propertyName,
      options: { message: 'Data inválida', ...options },
      validator: { validate: (v: unknown) => isIsoDate(v) },
    });
  };
}
