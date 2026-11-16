import { cpfValido } from './cpf.validator.js';

describe('cpfValido', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.444.777-35')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('52998224724')).toBe(false);
    expect(cpfValido('52998224715')).toBe(false);
  });

  it('recusa tamanho errado, letras, pontuação fora do lugar e dígitos repetidos', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529982247250')).toBe(false);
    expect(cpfValido('5299822472a')).toBe(false);
    expect(cpfValido('52.998.224-725')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});
