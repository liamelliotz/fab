import {
  ALFABETO_CODIGO,
  gerarCodigo,
  montarPayloadQr,
  normalizarCodigo,
} from './codigo.util.js';

describe('códigos de retirada e devolução', () => {
  it('gera 6 caracteres do alfabeto, sem I, L, O, 0 e 1', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = gerarCodigo();
      expect(codigo).toHaveLength(6);
      expect(codigo.split('').every((c) => ALFABETO_CODIGO.includes(c))).toBe(
        true,
      );
      expect(codigo).not.toMatch(/[ILO01]/);
    }
  });

  it('não repete um código que já está em uso', () => {
    const emUso = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const codigo = gerarCodigo(emUso);
      expect(emUso.has(codigo)).toBe(false);
      emUso.add(codigo);
    }
  });

  it('aceita o código digitado, com traço ou vindo do QR', () => {
    expect(normalizarCodigo(' h3q-8zw ')).toBe('H3Q8ZW');
    expect(normalizarCodigo('FAB:R:EMP-2026-0040:H3Q8ZW')).toBe('H3Q8ZW');
    expect(normalizarCodigo('fab:d:EMP-2026-0038:w4d7kc')).toBe('W4D7KC');
  });

  it('monta o conteúdo do QR', () => {
    expect(montarPayloadQr('R', 'EMP-2026-0040', 'H3Q8ZW')).toBe(
      'FAB:R:EMP-2026-0040:H3Q8ZW',
    );
  });
});
