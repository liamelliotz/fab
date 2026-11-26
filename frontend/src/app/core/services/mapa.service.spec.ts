import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuditoriaService } from './auditoria.service';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { ManutencaoService } from './manutencao.service';
import { MapaService } from './mapa.service';
import { environment } from '../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

describe('Mapa de itens e auditoria', () => {
  let mapa: MapaService;
  let emprestimos: EmprestimoService;
  let equipamentos: EquipamentoService;

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    mapa = TestBed.inject(MapaService);
    emprestimos = TestBed.inject(EmprestimoService);
    equipamentos = TestBed.inject(EquipamentoService);
  });
  afterEach(() => localStorage.clear());

  it('cada unidade do acervo aparece em exatamente um lugar do mapa', () => {
    for (const e of equipamentos.itens()) {
      const noMapa = mapa.ondeEsta(e.id).reduce((s, i) => s + i.quantidade, 0);
      expect(noMapa, e.nome).toBe(e.quantidadeTotal);
    }
  });

  it('o local muda só com registro: retirada com outro local e transferência com local novo', () => {
    const p41 = emprestimos.buscarPorId('p41')!; // aprovado, uso previsto no Lab. de Informática
    expect(mapa.ondeEsta('3').find((i) => i.pedidoId === 'p41')).toMatchObject({ situacao: 'reservado', localId: 'almox-ti' });

    // Sem o termo aceito, o balcão não entrega.
    expect(emprestimos.confirmarRetirada(p41.codigoRetirada!, { termoAceito: false }).ok).toBe(false);
    const r = emprestimos.confirmarRetirada(p41.codigoRetirada!, {
      termoAceito: true, localUso: { localId: 'sala-104', detalhe: 'Oficina web' },
    });
    expect(r.ok).toBe(true);
    const emUso = mapa.ondeEsta('3').find((i) => i.pedidoId === 'p41')!;
    expect(emUso).toMatchObject({ situacao: 'em_uso', localId: 'sala-104', responsavel: { id: 'usr-ana' } });
    const retirada = emprestimos.buscarPorId('p41')!.historico.at(-1)!;
    expect(retirada.detalhe).toContain('Sala 104');
    expect(retirada.detalhe).toContain('no pedido: Lab. de Informática');
    expect(retirada.detalhe).toContain('termo de responsabilidade aceito');

    // Transferência com local novo: só muda quando o destinatário aceita.
    TestBed.inject(AuthService).entrarComoDemo('usr-ana');
    expect(emprestimos.solicitarTransferencia('p41', 'usr-joao', 'Vou viajar e o João continua.', { localId: 'sala-102' })).toBeNull();
    expect(mapa.ondeEsta('3').find((i) => i.pedidoId === 'p41')!.localId).toBe('sala-104');
    TestBed.inject(AuthService).entrarComoDemo('usr-joao');
    expect(emprestimos.responderTransferencia('p41', true)).toBeNull();
    expect(mapa.ondeEsta('3').find((i) => i.pedidoId === 'p41')).toMatchObject({ localId: 'sala-102', responsavel: { id: 'usr-joao' } });
    expect(mapa.movimentos()[0]).toMatchObject({ protocolo: 'EMP-2026-0041' });
  });

  it('a auditoria junta empréstimos, manutenção, baixa com termo e insumos sem repetir eventos', () => {
    const registros = TestBed.inject(AuditoriaService).registros();
    const modulos = new Set(registros.map((r) => r.modulo));
    expect([...modulos].sort()).toEqual(['baixa', 'emprestimos', 'insumos', 'manutencao']);
    expect(registros.find((r) => r.modulo === 'baixa')).toMatchObject({ alvo: 'OC-2026-0000', gravidade: 'critico' });
    // A avaria da devolução do p35 aparece uma vez (pela manutenção), não duas.
    expect(registros.filter((r) => r.detalhe?.includes('Risco leve na lateral'))).toHaveLength(1);
    // Do mais novo para o mais antigo
    const datas = registros.map((r) => r.em);
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(TestBed.inject(ManutencaoService).baixas()[0].baixa!.protocolo).toBe('TB-2026-0001');
  });
});
