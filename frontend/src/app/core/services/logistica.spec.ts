import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { LogisticaService } from './logistica.service';
import { MapaService } from './mapa.service';
import { RequisicaoInsumoService } from './requisicao-insumo.service';
import { InsumoService } from './insumo.service';

const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

// Logística do balcão: separar antes da retirada, guardar depois da devolução, itens que ficam na sala.
describe('Logística do balcão', () => {
  let auth: AuthService;
  let emprestimos: EmprestimoService;
  let logistica: LogisticaService;
  let mapa: MapaService;
  let requisicoes: RequisicaoInsumoService;

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    auth.entrarComoDemo('usr-admin');
    emprestimos = TestBed.inject(EmprestimoService);
    logistica = TestBed.inject(LogisticaService);
    mapa = TestBed.inject(MapaService);
    requisicoes = TestBed.inject(RequisicaoInsumoService);
  });
  afterEach(() => localStorage.clear());

  const tarefa = (protocolo: string) => logistica.separacao().find((t) => t.protocolo === protocolo)!;
  const noMapa = (protocolo: string) => mapa.itens().find((i) => i.protocolo === protocolo && i.situacao === 'reservado');

  it('lista o que separar com o local de guarda e o roteiro por sala', () => {
    // p44 (Pedro, kit de ferramentas, retirada hoje) ainda não separado; p41 (Ana) já separado
    expect(tarefa('EMP-2026-0044')).toMatchObject({ feito: false, soNoLocal: false });
    expect(tarefa('EMP-2026-0041').feito).toBe(true);
    expect(logistica.aSeparar().map((t) => t.protocolo)).toContain('EMP-2026-0044');
    expect(logistica.aSeparar().map((t) => t.protocolo)).not.toContain('EMP-2026-0041');
    const paradas = logistica.roteiroSeparacao();
    expect(paradas.length).toBeGreaterThan(0);
    expect(paradas.flatMap((p) => p.linhas).some((l) => l.protocolo === 'EMP-2026-0044')).toBe(true);
    // O insumo aprovado (Jumpers) também entra na separação
    expect(logistica.separacao().some((t) => t.tipo === 'insumo' && t.protocolo.endsWith('-0002'))).toBe(true);
  });

  it('separar leva o material para o balcão no mapa e registra na linha do tempo', () => {
    const antes = noMapa('EMP-2026-0044')!.localId;
    expect(antes).not.toBe('coordenacao');
    expect(logistica.separar(tarefa('EMP-2026-0044'), true)).toBeNull();
    expect(noMapa('EMP-2026-0044')!.localId).toBe('coordenacao');
    const p = emprestimos.buscarPorId('p44')!;
    expect(p.separadoPor?.id).toBe('usr-admin');
    expect(p.historico.at(-1)?.tipo).toBe('separado');

    // Desfazer volta ao local de guarda
    expect(logistica.separar(tarefa('EMP-2026-0044'), false)).toBeNull();
    expect(noMapa('EMP-2026-0044')!.localId).toBe(antes);

    // Professor não separa
    auth.entrarComoDemo('usr-professor');
    expect(emprestimos.marcarSeparado('p44', true)).toContain('coordenação');
  });

  it('pedido separado e cancelado volta para "a guardar"', () => {
    expect(emprestimos.buscarPorId('p41')!.separadoEm).toBeTruthy();
    expect(emprestimos.cancelar('p41', 'A oficina foi adiada para a semana que vem')).toBeNull();
    const p = emprestimos.buscarPorId('p41')!;
    expect(p.aGuardar).toEqual([{ equipamentoId: '3', quantidade: 2 }]);
    expect(logistica.guarda().map((t) => t.protocolo)).toContain('EMP-2026-0041');
    // No mapa, as 2 unidades estão na Coordenação até alguém guardar
    const balcao = mapa.itens().filter((i) => i.localId === 'coordenacao' && i.equipamentoId === '3');
    expect(balcao.reduce((s, i) => s + i.quantidade, 0)).toBe(2);
  });

  it('devolução em ordem vai para "a guardar"; guardar fecha e o mapa volta ao local de origem', () => {
    expect(emprestimos.confirmarDevolucao('M2N9QD', { observacoes: '' }).ok).toBe(true);
    const p37 = emprestimos.buscarPorId('p37')!;
    expect(p37.aGuardar).toEqual([{ equipamentoId: '4', quantidade: 1 }]);
    expect(mapa.itens().some((i) => i.localId === 'coordenacao' && i.equipamentoId === '4')).toBe(true);

    const t = logistica.guarda().find((x) => x.protocolo === 'EMP-2026-0037')!;
    expect(logistica.guardar(t)).toBeNull();
    expect(emprestimos.buscarPorId('p37')).toMatchObject({ aGuardar: undefined, guardadoPor: { id: 'usr-admin' } });
    expect(emprestimos.buscarPorId('p37')!.historico.at(-1)?.tipo).toBe('guardado');
    expect(mapa.itens().some((i) => i.localId === 'coordenacao' && i.equipamentoId === '4')).toBe(false);
    expect(logistica.guardar(t)).toContain('Não há material');
  });

  it('equipamento que fica na sala não é separado nem vai para "a guardar"', () => {
    // p39: impressora 3D com o Pedro (fica na sala de prototipagem)
    const codigo = emprestimos.buscarPorId('p39')!.codigoDevolucao!;
    expect(emprestimos.confirmarDevolucao(codigo, { observacoes: '' }).ok).toBe(true);
    expect(emprestimos.buscarPorId('p39')!.aGuardar).toBeUndefined();

    // Pedido novo só com a impressora: retirada só no local
    auth.entrarComoDemo('usr-professor');
    const r = emprestimos.solicitar(
      {
        itens: [{ equipamentoId: '8', quantidade: 1 }],
        justificativa: 'Impressão das peças do projeto integrador',
        dataPrevistaRetirada: new Date().toISOString().slice(0, 10),
        dataPrevistaDevolucao: new Date().toISOString().slice(0, 10),
        localUso: { localId: 'lab-maker' },
      },
      auth.usuarioAtual(),
    );
    if (!r.ok) throw new Error(r.erro);
    auth.entrarComoDemo('usr-admin');
    expect(emprestimos.avaliar(r.valor.id, true, '')).toBeNull();
    expect(tarefa(r.valor.protocolo).soNoLocal).toBe(true);
    expect(logistica.aSeparar().some((t) => t.protocolo === r.valor.protocolo)).toBe(false);
    expect(emprestimos.marcarSeparado(r.valor.id, true)).toContain('fica na sala');
  });

  it('insumo: separar, entregar menos que o separado (a diferença volta a guardar) e sobra a guardar', () => {
    const r = requisicoes.buscarPorCodigo('J5P7RQ')!.req;
    expect(logistica.separar(tarefa(r.protocolo), true)).toBeNull();
    expect(requisicoes.buscarPorId(r.id)!.separadaEm).toBeTruthy();
    // Jumpers: 1 pacote aprovado. Pede um insumo maior para testar a diferença
    auth.entrarComoDemo('usr-professor');
    const nova = requisicoes.solicitar({
      insumoId: 'ins-papel', quantidade: 3, dataUso: new Date().toISOString().slice(0, 10),
      localId: 'sala-101', finalidade: 'Impressão das provas do bimestre',
    });
    if (!nova.ok) throw new Error(nova.erro);
    auth.entrarComoDemo('usr-admin');
    requisicoes.aprovar(nova.valor.id);
    requisicoes.marcarSeparada(nova.valor.id, true);
    const cod = requisicoes.buscarPorId(nova.valor.id)!.codigoRetirada!;
    expect(requisicoes.entregar(nova.valor.id, 2, cod)).toBeNull();
    expect(requisicoes.buscarPorId(nova.valor.id)!.aGuardar).toBe(1);
    expect(logistica.guarda().some((t) => t.protocolo === nova.valor.protocolo)).toBe(true);
    const saldo = TestBed.inject(InsumoService).buscarPorId('ins-papel')!.quantidadeAtual;

    const t = logistica.guarda().find((x) => x.protocolo === nova.valor.protocolo)!;
    expect(logistica.guardar(t)).toBeNull();
    expect(requisicoes.buscarPorId(nova.valor.id)!.aGuardar).toBeUndefined();
    // Guardar não mexe no saldo (o estoque já estava certo; é só o lugar físico)
    expect(TestBed.inject(InsumoService).buscarPorId('ins-papel')!.quantidadeAtual).toBe(saldo);
  });
});
