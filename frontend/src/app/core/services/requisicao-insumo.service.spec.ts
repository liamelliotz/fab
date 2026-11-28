import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuditoriaService } from './auditoria.service';
import { AuthService } from './auth.service';
import { InsumoService } from './insumo.service';
import { RequisicaoInsumoService } from './requisicao-insumo.service';
import { EmprestimoService } from './emprestimo.service';
import { CodigosService } from './codigos.service';
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

  it('fluxo completo no balcão: pedir → aprovar (reserva + código) → entregar com o código → sobra com o código', () => {
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

    const aprovada = req.buscarPorId(r.valor.id)!;
    expect(aprovada.codigoRetirada).toMatch(/^[A-Z2-9]{6}$/);
    expect(req.buscarPorCodigo(`FAB:R:${aprovada.protocolo}:${aprovada.codigoRetirada}`)).toMatchObject({ tipo: 'retirada' });

    const codigoR = aprovada.codigoRetirada!;
    expect(req.entregar(r.valor.id, 2, 'ZZZZZZ')).toContain('não confere');
    expect(req.entregar(r.valor.id, 3, codigoR)).toContain('aprovada');
    expect(req.entregar(r.valor.id, 2, codigoR)).toBeNull();
    const entregue = req.buscarPorId(r.valor.id)!;
    expect(entregue.codigoRetirada).toBeUndefined();
    expect(entregue.codigoDevolucao).toMatch(/^[A-Z2-9]{6}$/);
    expect(entregue.codigoDevolucao).not.toBe(codigoR);
    expect(entregue.prazoSobra).toBe(somarDias(hojeISO(), 7));
    expect(req.buscarPorCodigo(codigoR)).toBeNull(); // o código de retirada não vale mais
    expect(insumos.buscarPorId('ins-papel')!.quantidadeAtual).toBe(saldoInicial - 2);
    const saida = insumos.movimentacoes()[0];
    expect(saida).toMatchObject({ tipo: 'saida', motivo: 'uso_em_aula', quantidade: 2, localId: 'sala-101' });
    expect(saida.destinatario?.nome).toBe('Pedro Almeida');
    expect(saida.observacao).toContain(r.valor.protocolo);

    const codigoD = entregue.codigoDevolucao!;
    expect(req.buscarPorCodigo(codigoD)).toMatchObject({ tipo: 'devolucao' });
    expect(req.devolverSobra(r.valor.id, 1, codigoR)).toContain('não confere');
    expect(req.devolverSobra(r.valor.id, 3, codigoD)).toContain('entregue');
    expect(req.devolverSobra(r.valor.id, 1, codigoD)).toBeNull();
    expect(req.devolverSobra(r.valor.id, 1, codigoD)).toContain('já foi');
    expect(req.buscarPorCodigo(codigoD)).toBeNull();
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
    expect(req.buscarPorCodigo('J5P-7RQ')?.req.protocolo).toMatch(/-0002$/);
  });

  it('"usou tudo" encerra a requisição sem movimentar o estoque', () => {
    auth.entrarComoDemo('usr-admin');
    const r = req.buscarPorCodigo('J5P7RQ')!.req;
    expect(req.entregar(r.id, 1, 'J5P7RQ')).toBeNull();
    const saldo = insumos.buscarPorId(r.insumo.id)!.quantidadeAtual;
    const codigoD = req.buscarPorId(r.id)!.codigoDevolucao!;
    expect(req.devolverSobra(r.id, 0, codigoD)).toBeNull();
    expect(insumos.buscarPorId(r.insumo.id)!.quantidadeAtual).toBe(saldo);
    expect(req.buscarPorId(r.id)).toMatchObject({ quantidadeDevolvida: 0, codigoDevolucao: undefined });
    expect(req.buscarPorId(r.id)!.historico.at(-1)?.acao).toBe('encerrada');
  });

  it('prazos: aprovada não retirada expira e libera a reserva; sobra não devolvida encerra sozinha', () => {
    auth.entrarComoDemo('usr-admin');
    const r = req.buscarPorCodigo('J5P7RQ')!.req;
    const livre = req.disponivel(r.insumo.id);
    // Dia de uso há 3 dias (tolerância padrão: 1 dia) → expira
    req.requisicoes.update((l) => l.map((x) => (x.id === r.id ? { ...x, dataUso: somarDias(hojeISO(), -3) } : x)));
    expect(req.entregar(r.id, 1, 'J5P7RQ')).toContain('expirou');
    const expirada = req.buscarPorId(r.id)!;
    expect(expirada).toMatchObject({ status: 'cancelada', codigoRetirada: undefined });
    expect(expirada.motivo).toContain('Expirou');
    expect(expirada.historico.at(-1)).toMatchObject({ acao: 'expirada', por: { id: 'sistema' } });
    expect(req.disponivel(r.insumo.id)).toBe(livre + r.quantidade);

    // Sobra: passou o prazo → consumo integral, código de devolução deixa de valer
    const nova = (() => {
      auth.entrarComoDemo('usr-professor');
      const n = req.solicitar(pedido({ quantidade: 1 }));
      if (!n.ok) throw new Error(n.erro);
      auth.entrarComoDemo('usr-admin');
      req.aprovar(n.valor.id);
      req.entregar(n.valor.id, 1, req.buscarPorId(n.valor.id)!.codigoRetirada!);
      return req.buscarPorId(n.valor.id)!;
    })();
    req.requisicoes.update((l) => l.map((x) => (x.id === nova.id ? { ...x, prazoSobra: somarDias(hojeISO(), -1) } : x)));
    expect(req.aplicarPrazos()).toBe(1);
    expect(req.buscarPorId(nova.id)).toMatchObject({ quantidadeDevolvida: 0, codigoDevolucao: undefined });
    expect(req.buscarPorCodigo(nova.codigoDevolucao!)).toBeNull();
  });

  it('códigos do balcão nunca se repetem entre empréstimos e insumos', () => {
    const emprestimos = TestBed.inject(EmprestimoService);
    const doBalcao = TestBed.inject(CodigosService).emUso();
    for (const s of emprestimos.todas()) {
      if (s.codigoRetirada) expect(doBalcao.has(s.codigoRetirada)).toBe(true);
    }
    expect(doBalcao.has('J5P7RQ')).toBe(true);
    for (let i = 0; i < 50; i++) expect(doBalcao.has(TestBed.inject(CodigosService).novo())).toBe(false);
  });
});
