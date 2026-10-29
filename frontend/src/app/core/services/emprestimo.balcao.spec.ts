import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { normalizarCodigo } from '../utils/codigo.utils';

// Balcão: retirada e devolução só acontecem com o código (não existe registro sem código)
describe('Balcão: retirada e devolução com código', () => {
  let service: EmprestimoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    TestBed.inject(AuthService).entrarComoDemo('demo-admin'); // quem está no balcão
    service = TestBed.inject(EmprestimoService);
  });

  afterEach(() => localStorage.clear());

  it('recusa código vazio, inexistente e do tipo errado, sem alterar o pedido', () => {
    const pedido = service.buscarPorCodigoRetirada('H3Q8ZW');
    expect(pedido?.status).toBe('aprovado');

    expect(service.confirmarRetirada('').ok).toBe(false);
    expect(service.confirmarRetirada('ZZZZZZ').ok).toBe(false);
    // código de devolução digitado na aba de retirada
    const emUso = service.emAndamento()[0];
    const erro = service.confirmarRetirada(emUso.codigoDevolucao ?? '');
    expect(erro.ok).toBe(false);
    if (!erro.ok) expect(erro.erro).toContain('DEVOLUÇÃO');

    expect(service.buscarPorId(pedido!.id)?.status).toBe('aprovado');
  });

  it('retirada pelo código: vira em andamento e troca o código de retirada pelo de devolução', () => {
    const antes = service.buscarPorCodigoRetirada('H3Q8ZW')!;
    const r = service.confirmarRetirada('h3q-8zw'); // aceita minúsculas e hífen
    expect(r.ok).toBe(true);
    const depois = service.buscarPorId(antes.id)!;
    expect(depois.status).toBe('em_andamento');
    expect(depois.codigoRetirada).toBeUndefined();
    expect(depois.codigoDevolucao).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(depois.historico.at(-1)?.tipo).toBe('retirado');
    expect(depois.historico.at(-1)?.detalhe).toContain('código conferido');
    // o mesmo código não funciona duas vezes
    expect(service.confirmarRetirada('H3Q8ZW').ok).toBe(false);
  });

  it('aceita o conteúdo inteiro do QR (FAB:R:protocolo:código)', () => {
    expect(normalizarCodigo('FAB:R:EMP-2026-0042:K7M4PX')).toBe('K7M4PX');
    expect(service.confirmarRetirada('FAB:R:EMP-2026-0042:K7M4PX').ok).toBe(true);
  });

  it('devolução pelo código: devolve o estoque e anota avaria e atraso na linha do tempo', () => {
    service.confirmarRetirada('H3Q8ZW');
    const emUso = service.emAndamento().find((s) => s.codigoDevolucao && s.historico.at(-1)?.tipo === 'retirado')!;
    expect(service.confirmarDevolucao('XXXXXX', { houveAvaria: false, observacoes: '' }).ok).toBe(false);

    const r = service.confirmarDevolucao(emUso.codigoDevolucao!, { houveAvaria: true, observacoes: 'falta o cabo' });
    expect(r.ok).toBe(true);
    const fim = service.buscarPorId(emUso.id)!;
    expect(fim.status).toBe('devolvido');
    expect(fim.codigoDevolucao).toBeUndefined();
    const ultimo = fim.historico.at(-1)!;
    expect(ultimo.tipo).toBe('devolvido');
    expect(ultimo.detalhe).toContain('AVARIA');
    expect(ultimo.detalhe).toContain('falta o cabo');
    expect(ultimo.detalhe).toContain('código conferido');
  });
});
