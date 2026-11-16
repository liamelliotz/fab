import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Aceita "52998224725" ou "529.982.247-25" (com ou sem a pontuação). */
const FORMATO_CPF = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

/**
 * Confere se o CPF é válido: 11 dígitos e os dois dígitos verificadores certos.
 * CPFs com todos os dígitos iguais (111.111.111-11) passam na conta, mas não existem.
 */
export function cpfValido(valor: string): boolean {
  if (!FORMATO_CPF.test(valor)) return false;
  const cpf = valor.replace(/\D/g, '');
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Dígito verificador: soma ponderada dos dígitos anteriores (pesos 10..2 e depois 11..2).
  const digito = (quantos: number) => {
    let soma = 0;
    for (let i = 0; i < quantos; i++) {
      soma += Number(cpf[i]) * (quantos + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Decorator de DTO: `@IsCpf()`. Mensagem padrão: "CPF inválido." */
export function IsCpf(opcoes?: ValidationOptions) {
  return (objeto: object, propriedade: string) => {
    registerDecorator({
      name: 'isCpf',
      target: objeto.constructor,
      propertyName: propriedade,
      options: { message: 'CPF inválido.', ...opcoes },
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && cpfValido(valor),
      },
    });
  };
}
