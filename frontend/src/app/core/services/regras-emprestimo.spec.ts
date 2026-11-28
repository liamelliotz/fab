import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SolicitarEmprestimoDTO } from '../models/emprestimo.model';
import { hojeISO, somarDias } from '../utils/date.utils';
import { AuditoriaService } from './auditoria.service';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { RegrasEmprestimoService, regrasPadrao } from './regras-emprestimo.service';
import { UsuarioService } from './usuario.service';
import { environment } from '../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

const hoje = hojeISO();
const pedido = (equipamentoId: string, quantidade = 1): SolicitarEmprestimoDTO => ({
  itens: [{ equipamentoId, quantidade }],
  justificativa: 'Aula prática com a turma do 2º módulo.',
  dataPrevistaRetirada: hoje,
  dataPrevistaDevolucao: somarDias(hoje, 2),
  localUso: { localId: 'sala-102' },
});

// Regras de empréstimo: pedido aprovado expira, limite por categoria e política de atraso.
describe('Regras de empréstimo', () => {
  let auth: AuthService;
  let emprestimos: EmprestimoService;
  let equipamentos: EquipamentoService;
  let usuarios: UsuarioService;
  let regras: RegrasEmprestimoService;

  const solicitarComo = (id: string, dto: SolicitarEmprestimoDTO) => {
    auth.entrarComoDemo(id);
    return emprestimos.solicitar(dto, auth.usuarioAtual());
  };

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    auth.entrarComoDemo('usr-admin');
    emprestimos = TestBed.inject(EmprestimoService);
    equipamentos = TestBed.inject(EquipamentoService);
    usuarios = TestBed.inject(UsuarioService);
    regras = TestBed.inject(RegrasEmprestimoService);
  });

  afterEach(() => localStorage.clear());

  it('pedido aprovado e não retirado no prazo expira e devolve a reserva ao estoque', () => {
    // p41 (Ana, 2 notebooks Lenovo, aprovado): a retirada era há 3 dias e a tolerância é de 1 dia
    const antes = equipamentos.buscarPorId('3')!.quantidadeDisponivel;
    emprestimos.todas.update((l) => l.map((s) => (s.id === 'p41' ? { ...s, dataPrevistaRetirada: somarDias(hoje, -3) } : s)));

    expect(emprestimos.expirarNaoRetirados()).toBe(1);
    const p = emprestimos.buscarPorId('p41')!;
    expect(p.status).toBe('cancelado');
    expect(p.codigoRetirada).toBeUndefined();
    expect(p.motivoCancelamento).toContain('Expirou');
    expect(p.historico.at(-1)).toMatchObject({ tipo: 'expirado', por: { id: 'sistema' } });
    expect(equipamentos.buscarPorId('3')!.quantidadeDisponivel).toBe(antes + 2);
    expect(emprestimos.expirarNaoRetirados()).toBe(0); // não expira duas vezes

    // Dentro do prazo (hoje), o p44 continua aprovado
    expect(emprestimos.buscarPorId('p44')!.status).toBe('aprovado');
    expect(emprestimos.prazoRetirada(emprestimos.buscarPorId('p44')!)).toBe(somarDias(hoje, 1));
  });

  it('no balcão, o código de um pedido vencido não entrega o material', () => {
    emprestimos.todas.update((l) => l.map((s) => (s.id === 'p44' ? { ...s, dataPrevistaRetirada: somarDias(hoje, -2) } : s)));
    const r = emprestimos.confirmarRetirada('H3Q8ZW', { termoAceito: true });
    expect(r.ok).toBe(false);
    // Já tinha sido expirado pela rotina (ou é expirado agora): de qualquer jeito, não está mais aprovado
    expect(emprestimos.buscarPorId('p44')!.status).toBe('cancelado');
  });

  it('limite por categoria soma os pedidos abertos da pessoa', () => {
    // Pedro já está com 1 impressora 3D (p39) e o limite de impressora 3D é 1
    const r = solicitarComo('usr-professor', pedido('8'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('limite de Impressora 3D');

    // A coordenação aumenta o limite: agora pode
    auth.entrarComoDemo('usr-admin');
    const novas = { ...regras.regras(), limitePorCategoria: { ...regras.regras().limitePorCategoria, impressora_3d: 2 } };
    expect(regras.salvar(novas)).toBeNull();
    expect(solicitarComo('usr-professor', pedido('8')).ok).toBe(true);

    // Sem limite (null) também libera; limite inválido é recusado
    auth.entrarComoDemo('usr-admin');
    expect(regras.salvar({ ...novas, limitePorCategoria: { ...novas.limitePorCategoria, eletronico: 0 } })).toContain('Eletrônico');
  });

  it('com atraso, a política decide se a pessoa ainda pode pedir', () => {
    // Maria está com a caixa de som atrasada (p37). Padrão: suspensão (bloqueia enquanto houver atraso)
    const bloqueado = solicitarComo('usr-maria', pedido('1'));
    expect(bloqueado.ok).toBe(false);
    if (!bloqueado.ok) expect(bloqueado.erro).toContain('EMP-2026-0037');

    // Política "só avisar": pede normalmente
    auth.entrarComoDemo('usr-admin');
    expect(regras.salvar({ ...regras.regras(), politicaAtraso: 'aviso' })).toBeNull();
    expect(solicitarComo('usr-maria', pedido('1')).ok).toBe(true);
  });

  it('devolução atrasada suspende automaticamente (dias de atraso × fator) e a suspensão bloqueia pedidos', () => {
    // p37 venceu há 3 dias; fator padrão 2 → 6 dias de suspensão (hoje + 5, inclusive)
    const r = emprestimos.confirmarDevolucao('M2N9QD', { observacoes: '' });
    expect(r.ok).toBe(true);
    const ate = somarDias(hoje, 5);
    expect(usuarios.suspensao('usr-maria')).toEqual({ ate, motivo: '3 dia(s) de atraso na devolução do EMP-2026-0037' });
    const fim = emprestimos.buscarPorId('p37')!;
    expect(fim.historico.map((e) => e.tipo).slice(-2)).toEqual(['devolvido', 'suspensao_aplicada']);

    // Suspensa: não pede, e a coordenação não aprova o pedido que já estava pendente (p43)
    const tentativa = solicitarComo('usr-maria', pedido('1'));
    expect(tentativa.ok).toBe(false);
    if (!tentativa.ok) expect(tentativa.erro).toContain('suspenso');
    auth.entrarComoDemo('usr-admin');
    expect(emprestimos.avaliar('p43', true, '')).toContain('suspenso');

    // Nem recebe transferência
    const p38 = emprestimos.buscarPorId('p38')!;
    expect(emprestimos.candidatosTransferencia(p38).find((c) => c.usuario.id === 'usr-maria')?.bloqueio).toContain('Suspenso');

    // A coordenação encerra a suspensão: volta a pedir
    usuarios.encerrarSuspensao('usr-maria');
    expect(usuarios.suspensao('usr-maria')).toBeNull();
    expect(solicitarComo('usr-maria', pedido('1')).ok).toBe(true);
  });

  it('suspensão respeita o teto e nada acontece com a política de bloqueio', () => {
    expect(regras.diasDeSuspensao(3)).toBe(6);
    expect(regras.diasDeSuspensao(40)).toBe(30); // teto padrão
    expect(regras.diasDeSuspensao(0)).toBe(0);
    expect(regras.salvar({ ...regras.regras(), politicaAtraso: 'bloqueio' })).toBeNull();
    expect(regras.diasDeSuspensao(3)).toBe(0);
    expect(emprestimos.confirmarDevolucao('M2N9QD', { observacoes: '' }).ok).toBe(true);
    expect(usuarios.suspensao('usr-maria')).toBeNull();
  });

  it('só a coordenação altera as regras, e cada alteração vai para a auditoria', () => {
    const padrao = regrasPadrao();
    expect(regras.salvar(padrao)).toBe('Nada mudou.');
    expect(regras.salvar({ ...padrao, diasParaRetirar: 9 })).toContain('0 a 7');
    expect(regras.salvar({ ...padrao, fatorSuspensao: 0 })).toContain('por dia de atraso');

    expect(regras.salvar({ ...padrao, diasParaRetirar: 0, politicaAtraso: 'bloqueio' })).toBeNull();
    expect(regras.alteracoes()[0].mudancas).toEqual([
      'Prazo para retirar: 1 dia → 0 dias',
      'Política de atraso: Suspensão automática → Bloquear novos pedidos',
    ]);
    const auditoria = TestBed.inject(AuditoriaService).registros();
    expect(auditoria.some((r) => r.modulo === 'regras' && r.por === 'Administrador FAB')).toBe(true);

    auth.entrarComoDemo('usr-professor');
    expect(regras.salvar({ ...padrao, diasParaRetirar: 3 })).toContain('coordenação');
  });
});
