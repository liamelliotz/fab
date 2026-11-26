import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { InsumoService } from './insumo.service';
import { environment } from '../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

describe('Insumos (demonstração)', () => {
  let insumos: InsumoService;

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    insumos = TestBed.inject(InsumoService);
  });
  afterEach(() => localStorage.clear());

  it('o saldo de cada insumo de exemplo fecha com o histórico de movimentações', () => {
    for (const i of insumos.insumos()) {
      const movs = insumos.doInsumo(i.id);
      const soma = movs.reduce((s, m) => s + (m.tipo === 'entrada' ? m.quantidade : -m.quantidade), 0);
      expect(Math.round(soma * 1000) / 1000).toBe(i.quantidadeAtual);
      expect(movs[0].saldoApos).toBe(i.quantidadeAtual); // a mais nova guarda o saldo atual
    }
    expect(insumos.aRepor().map((i) => i.id).sort()).toEqual(['ins-jumpers', 'ins-pla', 'ins-toner']);
  });

  it('uso em aula exige professor, local e finalidade, e nunca deixa o saldo negativo', () => {
    const pla = insumos.buscarPorId('ins-pla')!;
    const base = { tipo: 'saida' as const, motivo: 'uso_em_aula' as const, quantidade: 1, observacao: 'Peças do robô' };
    expect(insumos.movimentar(pla.id, base).ok).toBe(false);
    expect(insumos.movimentar(pla.id, { ...base, destinatarioId: 'usr-professor' }).ok).toBe(false);
    expect(insumos.movimentar(pla.id, { ...base, destinatarioId: 'usr-professor', localId: 'lab-maker', quantidade: 99 })).toMatchObject({
      ok: false,
    });

    const r = insumos.movimentar(pla.id, { ...base, destinatarioId: 'usr-professor', localId: 'lab-maker' });
    expect(r.ok).toBe(true);
    const mov = insumos.doInsumo(pla.id)[0];
    expect(mov).toMatchObject({ saldoApos: pla.quantidadeAtual - 1, localId: 'lab-maker', destinatario: { id: 'usr-professor' } });
    expect(mov.responsavel.id).toBe('usr-admin');
  });

  it('entrada repõe o saldo e avisa quando uma saída leva ao estoque mínimo', () => {
    const papel = insumos.buscarPorId('ins-papel')!;
    expect(papel.estoqueBaixo).toBe(false);
    const saida = insumos.movimentar(papel.id, {
      tipo: 'saida', motivo: 'perda', quantidade: papel.quantidadeAtual - papel.estoqueMinimo, observacao: 'Molhou no telhado.',
    });
    expect(saida.ok && saida.valor.alertaEstoqueBaixo).toBe(true);
    expect(insumos.buscarPorId(papel.id)!.estoqueBaixo).toBe(true);

    const entrada = insumos.movimentar(papel.id, { tipo: 'entrada', motivo: 'compra', quantidade: 20, documento: 'NF 1' });
    expect(entrada.ok).toBe(true);
    expect(insumos.buscarPorId(papel.id)!).toMatchObject({ quantidadeAtual: papel.estoqueMinimo + 20, estoqueBaixo: false });
  });

  it('cadastro com saldo inicial vira uma movimentação; nome repetido é recusado', () => {
    expect(insumos.cadastrar({ nome: 'Pilhas AA', categoria: 'outros', unidadeMedida: 'un', estoqueMinimo: 1, localizacao: 'Coordenação' }).ok).toBe(false);
    const r = insumos.cadastrar({
      nome: 'Cola quente', categoria: 'outros', unidadeMedida: 'un', estoqueMinimo: 5, quantidadeInicial: 12, localizacao: 'Lab. Maker',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toMatchObject({ quantidadeAtual: 12, estoqueBaixo: false });
    expect(insumos.doInsumo(r.valor.id)).toHaveLength(1);
    expect(insumos.localDeGuarda(r.valor)).toBe('lab-maker');
  });

  it('previsão de término usa só o consumo em aula', () => {
    const pla = insumos.buscarPorId('ins-pla')!;
    const c = insumos.consumo(pla, 30);
    expect(c.totalConsumido).toBe(3); // dias 24, 12 e 5
    expect(c.diasRestantes).toBe(Math.floor(pla.quantidadeAtual / (3 / 30)));
    expect(insumos.relatorio(30)[0].diasRestantes).not.toBeNull();
  });
});
