import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuditoriaService } from './auditoria.service';
import { AuthService } from './auth.service';
import { InsumoService } from './insumo.service';
import { RequisicaoInsumoService } from './requisicao-insumo.service';
import { hojeISO, somarDias } from '../utils/date.utils';
import { environment } from '../../../environments/environment';

const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

describe('Requisições de insumo', () => {
  let auth: AuthService;
  let insumos: InsumoService;
  let req: RequisicaoInsumoService;

  const pedido = (extra: Record<string, unknown> = {}) => ({
    insumoId: 'ins-papel',
    quantidade: 2,
    dataUso: hojeISO(),
    localId: 'sala-101',
    turma: '1º ano',
    finalidade: 'Impressão das listas de exercícios',
    ...extra,
  });

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    auth.entrarComoDemo('usr-professor');
    insumos = TestBed.inject(InsumoService);
    req = TestBed.inject(RequisicaoInsumoService);
  });
  afterEach(() => localStorage.clear());

  it('valida quantidade, unidade inteira, saldo, data, local e finalidade', () => {
    const livre = req.disponivel('ins-papel');
    expect(req.solicitar(pedido({ quantidade: 0 })).ok).toBe(false);
    expect(req.validar(pedido({ quantidade: 1.5 }))).toContain('inteiro');
    expect(req.validar(pedido({ quantidade: livre + 1 }))).toContain('disponíveis');
    expect(req.validar(pedido({ dataUso: somarDias(hojeISO(), -1) }))).toContain('passado');
    expect(req.validar(pedido({ dataUso: somarDias(hojeISO(), 45) }))).toContain('antecedência');
    expect(req.validar(pedido({ localId: 'almox-ti' }))).toContain('usado');
    expect(req.validar(pedido({ finalidade: 'aula' }))).toContain('mínimo');
    expect(req.validar(pedido())).toBeNull();
    // Resina é em litros: aceita fração
    expect(req.validar(pedido({ insumoId: 'ins-resina', quantidade: 0.5 }))).toBeNull();
  });

  it('fluxo completo: pedir → aprovar (reserva) → entregar (saída) → sobra (consumo real)', () => {
    const saldoInicial = insumos.buscarPorId('ins-papel')!.quantidadeAtual;
    const r = req.solicitar(pedido());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.protocolo).toMatch(/^REQ-\d{4}-\d{4}$/);

    // Professor não aprova nem entrega
    expect(req.aprovar(r.valor.id)).toContain('coordenação');

    auth.entrarComoDemo('usr-admin');
    const livreAntes = req.disponivel('ins-papel');
    expect(req.aprovar(r.valor.id)).toBeNull();
    expect(req.disponivel('ins-papel')).toBe(livreAntes - 2);
    expect(insumos.buscarPorId('ins-papel')!.quantidadeAtual).toBe(saldoInicial); // reserva não mexe no saldo

    expect(req.entregar(r.valor.id, 3)).toContain('aprovada');
    expect(req.entregar(r.valor.id, 2)).toBeNull();
    expect(insumos.buscarPorId('ins-papel')!.quantidadeAtual).toBe(saldoInicial - 2);
    const saida = insumos.movimentacoes()[0];
    expect(saida).toMatchObject({ tipo: 'saida', motivo: 'uso_em_aula', quantidade: 2, localId: 'sala-101' });
    expect(saida.destinatario?.nome).toBe('Pedro Almeida');
    expect(saida.observacao).toContain(r.valor.protocolo);

    expect(req.devolverSobra(r.valor.id, 3)).toContain('entregue');
    expect(req.devolverSobra(r.valor.id, 1)).toBeNull();
    expect(req.devolverSobra(r.valor.id, 1)).toContain('já foi');
    expect(insumos.buscarPorId('ins-papel')!.quantidadeAtual).toBe(saldoInicial - 1);
    const final = req.buscarPorId(r.valor.id)!;
    expect(final).toMatchObject({ status: 'entregue', quantidadeEntregue: 2, quantidadeDevolvida: 1 });
    expect(final.historico.map((h) => h.acao)).toEqual(['solicitada', 'aprovada', 'entregue', 'sobra_devolvida']);
  });

  it('recusar e cancelar exigem motivo; só o dono cancela; tudo vai para a auditoria', () => {
    const r = req.solicitar(pedido({ quantidade: 1 }));
    if (!r.ok) throw new Error(r.erro);
    expect(req.cancelar(r.valor.id, 'não')).toContain('motivo');

    auth.entrarComoDemo('usr-ana');
    expect(req.cancelar(r.valor.id, 'Aula remarcada para outra semana')).toContain('Só quem pediu');

    auth.entrarComoDemo('usr-admin');
    expect(req.recusar(r.valor.id, 'curto')).toContain('motivo');
    expect(req.recusar(r.valor.id, 'Há papel reservado na sala dos professores')).toBeNull();
    expect(req.buscarPorId(r.valor.id)).toMatchObject({ status: 'recusada', motivo: 'Há papel reservado na sala dos professores' });

    const linhas = TestBed.inject(AuditoriaService).registros().filter((l) => l.alvo === r.valor.protocolo);
    expect(linhas.map((l) => l.acao)).toContain('Requisição de insumo recusada');
    expect(linhas.find((l) => l.acao.includes('recusada'))?.gravidade).toBe('aviso');
  });

  it('não aprova acima do disponível e reserva some ao cancelar', () => {
    auth.entrarComoDemo('usr-admin');
    const livre = req.disponivel('ins-papel');
    auth.entrarComoDemo('usr-professor');
    const a = req.solicitar(pedido({ quantidade: livre }));
    const b = req.solicitar(pedido({ quantidade: 1 }));
    if (!a.ok || !b.ok) throw new Error('pedido inválido');
    auth.entrarComoDemo('usr-admin');
    expect(req.aprovar(a.valor.id)).toBeNull();
    expect(req.disponivel('ins-papel')).toBe(0);
    expect(req.aprovar(b.valor.id)).toContain('Saldo insuficiente');
    auth.entrarComoDemo('usr-professor');
    expect(req.cancelar(a.valor.id, 'Turma foi para a feira de ciências')).toBeNull();
    expect(req.disponivel('ins-papel')).toBe(livre);
  });

  it('os exemplos da demonstração fecham com o estoque', () => {
    auth.entrarComoDemo('usr-admin');
    for (const r of req.requisicoes().filter((x) => x.status === 'aprovada')) {
      expect(insumos.buscarPorId(r.insumo.id)!.quantidadeAtual).toBeGreaterThanOrEqual(r.quantidade);
    }
    expect(req.pendentes().length).toBe(2);
    expect(req.aguardandoEntrega().length).toBe(1);
  });
});
