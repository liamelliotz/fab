import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Deixa só os números de um texto: "123.456" vira "123456". */
export const somenteNumeros = (valor: string | null | undefined): string =>
  (valor ?? '').replace(/\D/g, '');

/** Máscara de CPF enquanto se digita: 12345678900 vira 123.456.789-00. */
export function formatarCpf(valor: string): string {
  const n = somenteNumeros(valor).slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Máscara de telefone: 11999998888 vira (11) 99999-8888 e 1133334444 vira (11) 3333-4444. */
export function formatarTelefone(valor: string): string {
  const n = somenteNumeros(valor).slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : '';
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

// Dígito verificador do CPF (len = 9 para o 1º dígito, 10 para o 2º)
function digitoCpf(cpf: string, len: number): number {
  let soma = 0;
  for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Confere tamanho, sequências repetidas (111.111.111-11) e os dígitos verificadores. */
export function cpfEhValido(valor: string): boolean {
  const cpf = somenteNumeros(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  return digitoCpf(cpf, 9) === Number(cpf[9]) && digitoCpf(cpf, 10) === Number(cpf[10]);
}

/** Aceita 10 dígitos (fixo) ou 11 (celular), com DDD. */
export function telefoneEhValido(valor: string): boolean {
  const n = somenteNumeros(valor);
  return n.length === 10 || n.length === 11;
}

/** Validador de formulário: campo vazio passa (use Validators.required junto). */
export const cpfValido: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !somenteNumeros(c.value) || cpfEhValido(c.value) ? null : { cpfInvalido: true };

export const telefoneValido: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !somenteNumeros(c.value) || telefoneEhValido(c.value) ? null : { telefoneInvalido: true };
