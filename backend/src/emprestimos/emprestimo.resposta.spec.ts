import { Perfil, StatusEmprestimo } from '../common/enums/index.js';
import { criarEmprestimosSeed } from './emprestimos.seed.js';
import { paraResposta, statusParaResposta } from './emprestimo.resposta.js';
import type { Emprestimo } from './entities/emprestimo.entity.js';

const usuario = (id: string, perfil: Perfil) =>
  ({
    id, nome: `Nome ${id}`, email: `${id}@x.com`, senhaHash: 'hash',
    cpf: '12345678901', habilitacoes: [], perfil,
  }) as any;

const ctx = {
  usuarios: new Map([
    ['u1', usuario('u1', Perfil.Usuario)],
['u2', usuario('u2', Perfil.Usuario)],
    ['adm', usuario('adm', Perfil.Admin)],
  ]),
  equipamentos: new Map([['eq1', { id: 'eq1', nome: 'Projetor' } as any]]),
};

const base = (over: Partial<Emprestimo> = {}): Emprestimo =>
  ({
    id: 'e1', protocolo: 'EMP-2026-0001',
    solicitanteId: 'u1', responsavelId: 'u2', avaliadoPorId: 'adm',
    itens: [{ equipamentoId: 'eq1', quantidade: 1 }],
    justificativa: 'aula',
    status: StatusEmprestimo.EmAndamento,
    dataSolicitacao: '2026-10-20T10:00:00.000Z',
    dataPrevistaRetirada: '2026-10-25',
    dataPrevistaDevolucao: '2026-11-01',
    codigoDevolucao: 'DEV123',
    historico: [{ id: 'h1', tipo: 'criado', em: '2026-10-20T10:00:00.000Z', porId: 'u1' } as any],
    ...over,
  }) as Emprestimo;

const hoje = new Date(2026, 10, 13); // 13/11/2026

describe('statusParaResposta', () => {
  it('devolve "atrasado" quando em andamento e prazo vencido', () => {
    expect(statusParaResposta(base(), hoje)).toBe(StatusEmprestimo.Atrasado);
  });

  it('não muda o que está gravado', () => {
    const emp = base();
    statusParaResposta(emp, hoje);
    expect(emp.status).toBe(StatusEmprestimo.EmAndamento);
  });

  it('não marca atrasado no dia do prazo', () => {
    const emp = base({ dataPrevistaDevolucao: '2026-11-13' });
    expect(statusParaResposta(emp, hoje)).toBe(StatusEmprestimo.EmAndamento);
  });
});

describe('paraResposta', () => {
  it('troca ids por objetos resumidos e preenche o equipamento', () => {
    const r = paraResposta(base(), ctx.usuarios.get('adm'), ctx, hoje);
    expect(r.solicitante).toEqual({ id: 'u1', nome: 'Nome u1', email: 'u1@x.com', perfil: Perfil.Usuario, departamento: undefined });
    expect(r.responsavelAprovacao?.id).toBe('adm');
    expect(r.historico[0].por?.id).toBe('u1');
    expect(r.itens[0].equipamento?.nome).toBe('Projetor');
  });

  it('não vaza senhaHash nem cpf', () => {
    const json = JSON.stringify(paraResposta(base(), ctx.usuarios.get('adm'), ctx, hoje));
    expect(json).not.toContain('senhaHash');
    expect(json).not.toContain('12345678901');
  });

  it('não deixa nenhum id solto', () => {
    const emp = base({
      transferenciaPendente: { deId: 'u2', paraId: 'u1', motivo: 'x', solicitadaEm: '2026-11-10T10:00:00.000Z' },
    });
    const r: any = paraResposta(emp, ctx.usuarios.get('adm'), ctx, hoje);
    ['solicitanteId', 'responsavelId', 'avaliadoPorId'].forEach((k) => expect(r).not.toHaveProperty(k));
    expect(r.historico[0]).not.toHaveProperty('porId');
    expect(r.itens[0]).not.toHaveProperty('equipamentoId');
    expect(r.transferenciaPendente).not.toHaveProperty('deId');
    expect(r.transferenciaPendente).not.toHaveProperty('paraId');
    expect(r.transferenciaPendente.de.id).toBe('u2');
  });

  it('esconde os códigos de quem não é o responsável nem admin', () => {
    const r: any = paraResposta(base(), ctx.usuarios.get('u1'), ctx, hoje); // u1 é só o solicitante
    expect(r).not.toHaveProperty('codigoRetirada');
    expect(r).not.toHaveProperty('codigoDevolucao');
  });

  it('mostra os códigos para o responsável e para o admin', () => {
    const resp = paraResposta(base(), ctx.usuarios.get('u2'), ctx, hoje);
    const adm = paraResposta(base(), ctx.usuarios.get('adm'), ctx, hoje);
    expect(resp.codigoDevolucao).toBe('DEV123');
    expect(adm.codigoDevolucao).toBe('DEV123');
  });
});

describe('seed EMP-2026-0037', () => {
  it('sai atrasado na resposta e continua em_andamento no gravado', async () => {
    const seed = criarEmprestimosSeed();
    const emp = seed.find((e) => e.protocolo === 'EMP-2026-0037')!;
    expect(emp).toBeDefined();
    expect(statusParaResposta(emp)).toBe(StatusEmprestimo.Atrasado);
    expect(emp.status).toBe(StatusEmprestimo.EmAndamento);
  });
});