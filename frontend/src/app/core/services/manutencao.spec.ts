import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { AssistenciaService, cnpjValido } from './assistencia.service';
import { ManutencaoService } from './manutencao.service';
import { environment } from '../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

// Avarias e faltas: a gravidade decide o bloqueio, e só a unidade com problema sai do estoque.
describe('Avarias e faltas na devolução', () => {
  let emprestimos: EmprestimoService;
  let equipamentos: EquipamentoService;
  let manutencoes: ManutencaoService;

  /** Estoque do item: [disponíveis, em manutenção, total, status]. */
  const estoque = (id: string) => {
    const e = equipamentos.buscarPorId(id)!;
    return [e.quantidadeDisponivel, e.quantidadeEmManutencao ?? 0, e.quantidadeTotal, e.status];
  };

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
    emprestimos = TestBed.inject(EmprestimoService);
    equipamentos = TestBed.inject(EquipamentoService);
    manutencoes = TestBed.inject(ManutencaoService);
  });

  afterEach(() => localStorage.clear());

  it('o estoque de exemplo bate com os pedidos de exemplo', () => {
    for (const e of equipamentos.itens()) {
      const presas = emprestimos
        .todas()
        .filter((s) => s.status === 'aprovado' || s.status === 'em_andamento')
        .flatMap((s) => s.itens)
        .filter((i) => i.equipamentoId === e.id)
        .reduce((soma, i) => soma + i.quantidade, 0);
      expect(equipamentos.estoque(e).emprestadas, e.nome).toBe(presas);
    }
  });

  it('grave vai para manutenção, falta sai do estoque e o resto volta', () => {
    // Projetor (id 2): pedido p38 em andamento com 1 unidade
    const p38 = emprestimos.buscarPorId('p38')!;
    const r = emprestimos.confirmarDevolucao(p38.codigoDevolucao!, {
      observacoes: '',
      ocorrencias: [
        { equipamentoId: '2', avariadas: 1, faltando: 0, tipoAvaria: 'nao_liga', gravidade: 'grave', descricao: 'Lâmpada queimada.' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(estoque('2')).toEqual([3, 1, 4, 'disponivel']); // não volta: 3 continuam disponíveis
    const fim = emprestimos.buscarPorId('p38')!;
    expect(fim.historico.map((e) => e.tipo).slice(-2)).toEqual(['avaria_registrada', 'devolvido']);
    const oc = manutencoes.doPedido('p38')[0];
    expect(oc).toMatchObject({ status: 'aberta', bloqueia: true, responsavel: { id: 'usr-professor' } });

    // Consertada: volta ao estoque e o pedido ganha o evento
    expect(manutencoes.concluir(oc.id, 'Lâmpada trocada.')).toBeNull();
    expect(estoque('2')).toEqual([4, 0, 4, 'disponivel']);
    expect(emprestimos.buscarPorId('p38')!.historico.at(-1)!.tipo).toBe('manutencao_concluida');
  });

  it('avaria leve só registra; falta com baixa reduz o acervo', () => {
    const p41 = emprestimos.buscarPorId('p41')!; // 2 notebooks Lenovo aprovados
    emprestimos.confirmarRetirada(p41.codigoRetirada!);
    const codigo = emprestimos.buscarPorId('p41')!.codigoDevolucao!;
    emprestimos.confirmarDevolucao(codigo, {
      observacoes: '',
      ocorrencias: [
        { equipamentoId: '3', avariadas: 1, faltando: 1, tipoAvaria: 'desgaste', gravidade: 'leve', descricao: 'Tampa riscada.' },
      ],
    });
    // 8 no total: 6 + 1 (leve volta) = 7 disponíveis; 1 falta fora do estoque
    expect(estoque('3')).toEqual([7, 1, 8, 'disponivel']);
    const falta = manutencoes.doPedido('p41').find((m) => m.tipo === 'extravio')!;
    const dados = {
      motivo: 'extravio_definitivo' as const,
      parecer: 'Procurado em todas as salas por uma semana e não encontrado.',
      responsavelCiente: true,
      confirmacaoPatrimonio: 'PAT-0003',
    };
    expect(manutencoes.darBaixa(falta.id, { ...dados, motivo: undefined })).toContain('motivo');
    expect(manutencoes.darBaixa(falta.id, { ...dados, motivo: 'irreparavel' })).toContain('não vale');
    expect(manutencoes.darBaixa(falta.id, { ...dados, parecer: 'curto' })).toContain('parecer');
    expect(manutencoes.darBaixa(falta.id, { ...dados, responsavelCiente: false })).toContain('Ana Lima');
    expect(manutencoes.darBaixa(falta.id, { ...dados, confirmacaoPatrimonio: 'PAT-9999' })).toContain('PAT-0003');
    expect(manutencoes.darBaixa(falta.id, { ...dados, motivo: 'furto_roubo' })).toContain('boletim');
    expect(estoque('3')).toEqual([7, 1, 8, 'disponivel']); // nada mudou com dados inválidos

    expect(manutencoes.darBaixa(falta.id, { ...dados, confirmacaoPatrimonio: ' pat-0003 ' })).toBeNull();
    expect(estoque('3')).toEqual([7, 0, 7, 'disponivel']);
    const termo = manutencoes.buscarPorId(falta.id)!.baixa!;
    expect(termo).toMatchObject({ motivo: 'extravio_definitivo', responsavelCiente: true, autorizadoPor: { perfil: 'admin' } });
    // Valor vem do cadastro (1 × R$ 2.899,00), sem digitação
    expect(termo.valorEstimado).toBe(2899);
    expect(termo.protocolo).toMatch(/^TB-\d{4}-\d{4}$/);
    expect(manutencoes.darBaixa(falta.id, dados)).toContain('resolvida'); // não dá baixa duas vezes
  });

  it('não aceita avaria sem tipo, gravidade e descrição nem quantidade maior que a emprestada', () => {
    const p38 = emprestimos.buscarPorId('p38')!;
    const tentar = (oc: object) =>
      emprestimos.confirmarDevolucao(p38.codigoDevolucao!, { observacoes: '', ocorrencias: [{ equipamentoId: '2', faltando: 0, avariadas: 1, ...oc }] });
    expect(tentar({}).ok).toBe(false);
    expect(tentar({ tipoAvaria: 'outro', gravidade: 'grave', descricao: '' }).ok).toBe(false);
    expect(tentar({ tipoAvaria: 'outro', gravidade: 'grave', descricao: 'Quebrou.', avariadas: 2 }).ok).toBe(false);
    expect(emprestimos.buscarPorId('p38')!.status).toBe('em_andamento'); // nada mudou
  });

  it('item com todas as unidades em manutenção não pode ser pedido', () => {
    expect(estoque('7')[3]).toBe('em_manutencao');
    const erro = emprestimos.validarSolicitacao(
      { itens: [{ equipamentoId: '7', quantidade: 1 }], justificativa: 'Aula', dataPrevistaRetirada: '2099-01-01', dataPrevistaDevolucao: '2099-01-02' },
      'usr-professor',
    );
    expect(erro).toBe('Este material não está mais disponível.');
  });

  it('conserto só vai para assistência credenciada, em dia e da categoria do equipamento', () => {
    const assist = TestBed.inject(AssistenciaService);
    const oc = manutencoes.registrar({
      tipo: 'avaria', equipamentoId: '5', quantidade: 1, tipoAvaria: 'nao_liga', gravidade: 'grave',
      descricao: 'Multímetro não liga.', origem: 'estoque',
    });
    // Multímetro é "eletrônico": a oficina de ferramentas e a vencida não aparecem
    const opcoes = manutencoes.assistenciasPara(oc).map((a) => a.id);
    expect(opcoes).toEqual(['ast-tech']);
    expect(manutencoes.enviarParaAssistencia(oc.id, 'ast-ferramentas')).toContain('não conserta');
    expect(manutencoes.enviarParaAssistencia(oc.id, 'ast-antiga')).toContain('venceu');
    expect(manutencoes.enviarParaAssistencia(oc.id, '')).toContain('Escolha');
    assist.alternarAtiva('ast-tech');
    expect(manutencoes.enviarParaAssistencia(oc.id, 'ast-tech')).toContain('descredenciada');
    assist.alternarAtiva('ast-tech');
    expect(manutencoes.enviarParaAssistencia(oc.id, 'ast-tech')).toBeNull();
    const enviada = manutencoes.buscarPorId(oc.id)!;
    expect(enviada).toMatchObject({ status: 'em_assistencia', assistenciaId: 'ast-tech', assistencia: 'Tech Assistência' });
    expect(enviada.historico.at(-1)!.texto).toContain('CNPJ');
  });

  it('cadastro de assistência valida CNPJ, contato, especialidade e prazo', () => {
    const assist = TestBed.inject(AssistenciaService);
    const dados = {
      nomeFantasia: 'Conserta Já', razaoSocial: 'Conserta Já Ltda', cnpj: '11.111.111/1111-11', telefone: '(96) 3222-1111',
      email: 'contato@consertaja.com.br', especialidades: ['ferramenta' as const], credenciadaAte: '2099-12-31',
    };
    expect(assist.validar(dados)).toContain('CNPJ');
    expect(assist.validar({ ...dados, cnpj: assist.todas()[0].cnpj })).toContain('Já existe');
    const valido = '11444777000161'; // número de exemplo com dígitos verificadores corretos
    expect(cnpjValido(valido)).toBe(true);
    expect(assist.validar({ ...dados, cnpj: valido, telefone: '1234' })).toContain('telefone');
    expect(assist.validar({ ...dados, cnpj: valido, email: 'sem-arroba' })).toContain('e-mail');
    expect(assist.validar({ ...dados, cnpj: valido, especialidades: [] })).toContain('especialidade');
    expect(assist.validar({ ...dados, cnpj: valido, credenciadaAte: '2020-01-01' })).toContain('venceu');
    const r = assist.cadastrar({ ...dados, cnpj: '11.444.777/0001-61' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toMatchObject({ cnpj: valido, telefone: '9632221111', ativa: true });
  });
});
