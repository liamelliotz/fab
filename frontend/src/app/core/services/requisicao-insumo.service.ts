import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { LOCAIS_DE_USO, nomeLocal } from '../constants/escola-modelo.constants';
import { UnidadeMedida } from '../models/insumo.model';
import {
  AcaoRequisicaoInsumo,
  EventoRequisicaoInsumo,
  NovaRequisicaoInsumo,
  RequisicaoInsumo,
  StatusRequisicaoInsumo,
} from '../models/requisicao-insumo.model';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { UsuarioResumo } from '../models/usuario.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { agoraISO, formatarData, hojeISO, somarDias } from '../utils/date.utils';
import { normalizarCodigo } from '../utils/codigo.utils';
import { AuthService } from './auth.service';
import { CodigosService } from './codigos.service';
import { RegrasEmprestimoService } from './regras-emprestimo.service';
import { InsumoService, NOME_UNIDADE, formatarQuantidade } from './insumo.service';
import { resumoDemo } from './usuario.service';

const CHAVE = 'fab_demo_v9_requisicoes_insumo';

/** Prazo máximo, em dias, entre o pedido e o dia de uso. */
export const ANTECEDENCIA_MAXIMA_DIAS = 30;
/** Dias, depois do dia de uso, para devolver a sobra no balcão. */
export const DIAS_PARA_SOBRA = 7;
/** Quem assina o que o sistema faz sozinho (expirar, encerrar). */
const SISTEMA: UsuarioResumo = { id: 'sistema', nome: 'Sistema FAB', email: '', perfil: 'admin' };
/** Tamanho mínimo da finalidade e dos motivos (evita "ok", "x"). */
export const MINIMO_TEXTO = 10;
/** Unidades que só aceitam números inteiros (ninguém pede meio pacote). */
const UNIDADES_INTEIRAS: UnidadeMedida[] = ['un', 'cx', 'pct', 'rolo'];

export const NOME_STATUS_REQUISICAO: Record<StatusRequisicaoInsumo, string> = {
  pendente: 'Aguardando aprovação',
  aprovada: 'Aprovada · retirar no balcão',
  entregue: 'Entregue',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
};

export const NOME_ACAO_REQUISICAO: Record<AcaoRequisicaoInsumo, string> = {
  solicitada: 'Requisição de insumo enviada',
  aprovada: 'Requisição de insumo aprovada',
  recusada: 'Requisição de insumo recusada',
  cancelada: 'Requisição de insumo cancelada',
  entregue: 'Insumo entregue no balcão',
  sobra_devolvida: 'Sobra devolvida no balcão',
  expirada: 'Requisição expirada',
  encerrada: 'Requisição encerrada sem sobra',
  separada: 'Insumo separado no balcão',
  guardada: 'Insumo guardado no local',
};

/** Resultado da leitura de um código no balcão. */
export interface CodigoInsumo {
  req: RequisicaoInsumo;
  /** retirada = entregar o insumo; devolucao = receber a sobra. */
  tipo: 'retirada' | 'devolucao';
}

export function aceitaFracao(unidade: UnidadeMedida): boolean {
  return !UNIDADES_INTEIRAS.includes(unidade);
}

const arredondar = (n: number) => Math.round(n * 1000) / 1000;

/**
 * REQUISIÇÕES DE INSUMO (modo demonstração).
 *
 * Regras:
 *  - o professor informa a quantidade prevista, o dia e o local de uso e a finalidade;
 *  - a quantidade não pode passar do DISPONÍVEL (saldo menos o que já está reservado);
 *  - aprovar reserva a quantidade; entregar registra a saída no estoque (uso em aula);
 *  - recusar e cancelar exigem motivo; tudo entra no histórico e na auditoria.
 */
@Injectable({ providedIn: 'root' })
export class RequisicaoInsumoService {
  private readonly auth = inject(AuthService);
  private readonly insumos = inject(InsumoService);
  private readonly regras = inject(RegrasEmprestimoService);
  private readonly codigos = inject(CodigosService);

  readonly requisicoes = signal<RequisicaoInsumo[]>(lerJson<RequisicaoInsumo[]>(CHAVE) ?? criarRequisicoesDemo());

  readonly pendentes = computed(() => this.requisicoes().filter((r) => r.status === 'pendente'));
  readonly aguardandoEntrega = computed(() => this.requisicoes().filter((r) => r.status === 'aprovada'));
  /** Sobras (ou separações desfeitas) no balcão esperando voltar ao local de guarda. */
  readonly paraGuardar = computed(() => this.requisicoes().filter((r) => (r.aGuardar ?? 0) > 0));
  /** Entregues cuja sobra ainda pode voltar pelo balcão. */
  readonly aguardandoSobra = computed(() => this.requisicoes().filter((r) => r.status === 'entregue' && !!r.codigoDevolucao));
  /** Itens que pedem ação da coordenação (badge da navbar). */
  readonly paraCoordenacao = computed(() => this.pendentes().length + this.aguardandoEntrega().length);

  constructor() {
    effect(() => gravarJson(CHAVE, this.requisicoes()));
    ouvirOutrasAbas<RequisicaoInsumo[]>(CHAVE, (v) => v && this.requisicoes.set(v));
    this.codigos.registrar(() => this.requisicoes().flatMap((r) => [r.codigoRetirada, r.codigoDevolucao]));
    // Prazos automáticos: ao abrir e a cada minuto (só no navegador).
    if (typeof window !== 'undefined') {
      this.aplicarPrazos();
      setInterval(() => this.aplicarPrazos(), 60_000);
    }
  }

  // ---------- Balcão ----------

  /** Último dia para retirar uma requisição aprovada (dia de uso + tolerância das regras). */
  prazoRetirada(r: RequisicaoInsumo): string {
    return this.regras.prazoRetirada(r.dataUso);
  }

  /**
   * Procura a requisição pelo código digitado ou lido do QR (FAB:R:REQ-…:CÓDIGO).
   * Só vale código "vivo": de retirada enquanto aprovada; de devolução enquanto a sobra pode voltar.
   */
  buscarPorCodigo(texto: string): CodigoInsumo | null {
    const codigo = normalizarCodigo(texto);
    if (!codigo) return null;
    for (const req of this.requisicoes()) {
      if (req.status === 'aprovada' && req.codigoRetirada === codigo) return { req, tipo: 'retirada' };
      if (req.status === 'entregue' && req.codigoDevolucao === codigo) return { req, tipo: 'devolucao' };
    }
    return null;
  }

  /**
   * Expira as aprovadas não retiradas no prazo (a reserva volta) e encerra as entregues cujo
   * prazo de sobra terminou (consumo integral). Devolve quantas mudaram.
   */
  aplicarPrazos(): number {
    const hoje = hojeISO();
    let mudou = 0;
    for (const r of this.requisicoes()) {
      if (r.status === 'aprovada' && this.prazoRetirada(r) < hoje) {
        const texto = `Não foi retirada até ${formatarData(this.prazoRetirada(r))}. A reserva voltou ao estoque.`;
        this.mudarComo(SISTEMA, r.id, { status: 'cancelada', motivo: `Expirou: ${texto}`, codigoRetirada: undefined, ...this.desfazerSeparacao(r) }, 'expirada', texto);
        mudou++;
      } else if (r.status === 'entregue' && r.codigoDevolucao && r.prazoSobra && r.prazoSobra < hoje) {
        const texto = `Prazo para devolver a sobra terminou em ${formatarData(r.prazoSobra)}: consumo integral de ${this.qtd(r.quantidadeEntregue ?? 0, r.insumo.unidadeMedida)}.`;
        this.mudarComo(SISTEMA, r.id, { quantidadeDevolvida: 0, codigoDevolucao: undefined }, 'encerrada', texto);
        mudou++;
      }
    }
    return mudou;
  }

  // ---------- Consultas ----------

  buscarPorId(id: string): RequisicaoInsumo | undefined {
    return this.requisicoes().find((r) => r.id === id);
  }

  minhas(): RequisicaoInsumo[] {
    const eu = this.auth.usuarioAtual().id;
    return this.requisicoes().filter((r) => r.solicitante.id === eu);
  }

  /** Quantidade reservada por requisições aprovadas que ainda não saíram do estoque. */
  reservado(insumoId: string, ignorarId?: string): number {
    return arredondar(
      this.requisicoes()
        .filter((r) => r.insumo.id === insumoId && r.status === 'aprovada' && r.id !== ignorarId)
        .reduce((s, r) => s + r.quantidade, 0),
    );
  }

  /** Saldo que ainda pode ser pedido: estoque atual menos o reservado. */
  disponivel(insumoId: string, ignorarId?: string): number {
    const i = this.insumos.buscarPorId(insumoId);
    if (!i || !i.ativo) return 0;
    return Math.max(0, arredondar(i.quantidadeAtual - this.reservado(insumoId, ignorarId)));
  }

  // ---------- Professor ----------

  validar(dados: NovaRequisicaoInsumo): string | null {
    const i = this.insumos.buscarPorId(dados.insumoId);
    if (!i || !i.ativo) return 'Este insumo não está disponível para pedido.';
    const erroQtd = this.validarQuantidade(dados.quantidade, i.unidadeMedida);
    if (erroQtd) return erroQtd;
    const livre = this.disponivel(i.id);
    if (dados.quantidade > livre) {
      return livre === 0
        ? `"${i.nome}" está sem saldo disponível no momento.`
        : `Há só ${formatarQuantidade(livre)} ${NOME_UNIDADE[i.unidadeMedida]} disponíveis de "${i.nome}".`;
    }
    const hoje = hojeISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataUso ?? '')) return 'Informe o dia de uso.';
    if (dados.dataUso < hoje) return 'O dia de uso não pode estar no passado.';
    if (dados.dataUso > somarDias(hoje, ANTECEDENCIA_MAXIMA_DIAS)) {
      return `Peça com no máximo ${ANTECEDENCIA_MAXIMA_DIAS} dias de antecedência.`;
    }
    if (!LOCAIS_DE_USO.some((l) => l.id === dados.localId)) return 'Escolha onde o insumo será usado.';
    if ((dados.finalidade ?? '').trim().length < MINIMO_TEXTO) {
      return `Descreva a aula ou o projeto (mínimo de ${MINIMO_TEXTO} caracteres).`;
    }
    if ((dados.turma ?? '').length > 60) return 'A turma deve ter no máximo 60 caracteres.';
    return null;
  }

  solicitar(dados: NovaRequisicaoInsumo): Resultado<RequisicaoInsumo> {
    const erro = this.validar(dados);
    if (erro) return falha(erro);
    const i = this.insumos.buscarPorId(dados.insumoId)!;
    const eu = this.eu();
    const req: RequisicaoInsumo = {
      id: crypto.randomUUID(),
      protocolo: this.proximoProtocolo(),
      insumo: { id: i.id, nome: i.nome, unidadeMedida: i.unidadeMedida },
      solicitante: eu,
      quantidade: arredondar(dados.quantidade),
      dataUso: dados.dataUso,
      localId: dados.localId,
      turma: dados.turma?.trim() || undefined,
      finalidade: dados.finalidade.trim(),
      status: 'pendente',
      criadaEm: agoraISO(),
      historico: [
        this.evento('solicitada', eu, `${this.qtd(dados.quantidade, i.unidadeMedida)} para ${nomeLocal(dados.localId)}`),
      ],
    };
    this.requisicoes.update((lista) => [req, ...lista]);
    return sucesso(req);
  }

  /** O professor cancela a própria requisição antes da entrega (motivo obrigatório). */
  cancelar(id: string, motivo: string): string | null {
    const r = this.buscarPorId(id);
    if (!r) return 'Requisição não encontrada.';
    if (r.solicitante.id !== this.auth.usuarioAtual().id) return 'Só quem pediu pode cancelar a requisição.';
    if (r.status !== 'pendente' && r.status !== 'aprovada') return 'Esta requisição não pode mais ser cancelada.';
    const texto = (motivo ?? '').trim();
    if (texto.length < MINIMO_TEXTO) return `Explique o motivo do cancelamento (mínimo de ${MINIMO_TEXTO} caracteres).`;
    this.mudar(id, { status: 'cancelada', motivo: texto, codigoRetirada: undefined, ...this.desfazerSeparacao(r) }, 'cancelada', `Motivo: ${texto}`);
    return null;
  }

  // ---------- Coordenação ----------

  aprovar(id: string): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || r.status !== 'pendente') return 'Só requisições pendentes podem ser aprovadas.';
    const livre = this.disponivel(r.insumo.id, r.id);
    if (r.quantidade > livre) {
      return `Saldo insuficiente para aprovar: há ${this.qtd(livre, r.insumo.unidadeMedida)} disponíveis.`;
    }
    this.mudar(
      id,
      { status: 'aprovada', codigoRetirada: this.codigos.novo() },
      'aprovada',
      `${this.qtd(r.quantidade, r.insumo.unidadeMedida)} reservados · retirar no balcão até ${formatarData(this.prazoRetirada(r))}`,
    );
    return null;
  }

  recusar(id: string, motivo: string): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || (r.status !== 'pendente' && r.status !== 'aprovada')) return 'Esta requisição não pode mais ser recusada.';
    const texto = (motivo ?? '').trim();
    if (texto.length < MINIMO_TEXTO) return `Explique o motivo da recusa (mínimo de ${MINIMO_TEXTO} caracteres).`;
    this.mudar(id, { status: 'recusada', motivo: texto, codigoRetirada: undefined, ...this.desfazerSeparacao(r) }, 'recusada', `Motivo: ${texto}`);
    return null;
  }

  /**
   * Entrega no balcão, com o CÓDIGO de retirada conferido: registra a SAÍDA no estoque (uso em
   * aula), com o professor, o local e o protocolo, e gera o código de devolução da sobra.
   * Pode entregar menos que o previsto, nunca mais.
   */
  entregar(id: string, quantidade: number, codigo: string): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || r.status !== 'aprovada') return 'Só requisições aprovadas podem ser entregues.';
    if (!r.codigoRetirada || normalizarCodigo(codigo) !== r.codigoRetirada) {
      return 'Código de retirada não confere. Peça ao professor o código ou o QR do pedido.';
    }
    if (this.prazoRetirada(r) < hojeISO()) {
      this.aplicarPrazos();
      return `Esta requisição expirou: o prazo para retirar era ${formatarData(this.prazoRetirada(r))}.`;
    }
    const erroQtd = this.validarQuantidade(quantidade, r.insumo.unidadeMedida);
    if (erroQtd) return erroQtd;
    if (quantidade > r.quantidade) return 'A entrega não pode passar da quantidade aprovada.';
    const saida = this.insumos.movimentar(r.insumo.id, {
      tipo: 'saida',
      motivo: 'uso_em_aula',
      quantidade,
      destinatarioId: r.solicitante.id,
      localId: r.localId,
      observacao: `${r.protocolo} · ${r.finalidade}`,
    });
    if (!saida.ok) return saida.erro;
    const parcial = quantidade < r.quantidade ? ` (previsto: ${this.qtd(r.quantidade, r.insumo.unidadeMedida)})` : '';
    const prazoSobra = somarDias(r.dataUso > hojeISO() ? r.dataUso : hojeISO(), DIAS_PARA_SOBRA);
    this.mudar(
      id,
      {
        status: 'entregue',
        quantidadeEntregue: arredondar(quantidade),
        codigoRetirada: undefined,
        codigoDevolucao: this.codigos.novo(),
        prazoSobra,
        // Separou mais do que entregou: a diferença volta a ser guardada.
        ...(r.separadaEm && quantidade < r.quantidade ? { aGuardar: arredondar(r.quantidade - quantidade) } : {}),
      },
      'entregue',
      `${this.qtd(quantidade, r.insumo.unidadeMedida)} para ${r.solicitante.nome}${parcial} · código conferido · sobra até ${formatarData(prazoSobra)}`,
    );
    return null;
  }

  /**
   * Sobra no balcão, com o CÓDIGO de devolução conferido. `quantidade` 0 = usou tudo (encerra
   * sem movimentar o estoque). A sobra volta ao estoque e o consumo real é ajustado.
   */
  devolverSobra(id: string, quantidade: number, codigo: string): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || r.status !== 'entregue' || r.quantidadeEntregue === undefined) return 'Só requisições entregues têm sobra.';
    if (r.quantidadeDevolvida !== undefined || !r.codigoDevolucao) return 'A sobra desta requisição já foi registrada.';
    if (normalizarCodigo(codigo) !== r.codigoDevolucao) {
      return 'Código de devolução não confere. Peça ao professor o código ou o QR de devolução.';
    }
    const unidade = r.insumo.unidadeMedida;
    if (quantidade === 0) {
      this.mudar(id, { quantidadeDevolvida: 0, codigoDevolucao: undefined }, 'encerrada',
        `Usou tudo: consumo real ${this.qtd(r.quantidadeEntregue, unidade)} · código conferido`);
      return null;
    }
    const erroQtd = this.validarQuantidade(quantidade, unidade);
    if (erroQtd) return erroQtd;
    if (quantidade > r.quantidadeEntregue) {
      return `A sobra não pode passar do que foi entregue (${this.qtd(r.quantidadeEntregue, unidade)}).`;
    }
    const entrada = this.insumos.movimentar(r.insumo.id, {
      tipo: 'entrada',
      motivo: 'ajuste_positivo',
      quantidade,
      documento: r.protocolo,
      observacao: `Sobra devolvida no balcão por ${r.solicitante.nome}`,
    });
    if (!entrada.ok) return entrada.erro;
    const consumo = arredondar(r.quantidadeEntregue - quantidade);
    this.mudar(
      id,
      { quantidadeDevolvida: arredondar(quantidade), codigoDevolucao: undefined, aGuardar: arredondar(quantidade) },
      'sobra_devolvida',
      `${this.qtd(quantidade, unidade)} de volta · consumo real ${this.qtd(consumo, unidade)} · código conferido`,
    );
    return null;
  }

  // ---------- Logística do balcão ----------

  /** Marca (ou desfaz) a separação: a quantidade aprovada já está pronta no balcão. */
  marcarSeparada(id: string, separada: boolean): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || r.status !== 'aprovada') return 'Só requisições aprovadas, ainda não entregues, são separadas.';
    if (separada === !!r.separadaEm) return null;
    const eu = this.eu();
    this.mudar(
      id,
      { separadaEm: separada ? agoraISO() : undefined, separadaPor: separada ? eu : undefined },
      'separada',
      separada
        ? `${this.qtd(r.quantidade, r.insumo.unidadeMedida)} pronto(s) no balcão para a retirada`
        : 'Separação desfeita: o insumo voltou ao local de guarda',
    );
    return null;
  }

  /** A sobra (ou a separação desfeita) foi levada de volta ao local de guarda. */
  marcarGuardada(id: string): string | null {
    const erro = this.exigirCoordenacao();
    if (erro) return erro;
    const r = this.buscarPorId(id);
    if (!r || !(r.aGuardar && r.aGuardar > 0)) return 'Não há insumo desta requisição esperando para ser guardado.';
    const i = this.insumos.buscarPorId(r.insumo.id);
    this.mudar(
      id,
      { aGuardar: undefined, guardadaEm: agoraISO(), guardadaPor: this.eu() },
      'guardada',
      `${this.qtd(r.aGuardar, r.insumo.unidadeMedida)} → ${i?.localizacao ?? 'local de guarda'}`,
    );
    return null;
  }

  /** Requisição separada que não vai mais ser entregue: a quantidade volta a ser guardada. */
  private desfazerSeparacao(r: RequisicaoInsumo): Partial<RequisicaoInsumo> {
    return r.separadaEm ? { separadaEm: undefined, separadaPor: undefined, aGuardar: r.quantidade } : {};
  }

  reiniciar(): void {
    this.requisicoes.set(criarRequisicoesDemo());
  }

  // ---------- Auxiliares ----------

  qtd(valor: number, unidade: UnidadeMedida): string {
    return `${formatarQuantidade(valor)} ${NOME_UNIDADE[unidade]}`;
  }

  private validarQuantidade(q: number, unidade: UnidadeMedida): string | null {
    if (!Number.isFinite(q) || q <= 0) return 'A quantidade deve ser maior que zero.';
    if (!aceitaFracao(unidade) && !Number.isInteger(q)) return `Use um número inteiro de ${NOME_UNIDADE[unidade]}.`;
    if (Math.round(q * 1000) !== q * 1000) return 'Use no máximo três casas decimais.';
    return null;
  }

  private exigirCoordenacao(): string | null {
    return this.auth.perfilAtual()?.toLowerCase() === 'admin' ? null : 'Só a coordenação pode fazer isso.';
  }

  private eu(): UsuarioResumo {
    const u = this.auth.usuarioAtual();
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, departamento: u.departamento };
  }

  private evento(acao: AcaoRequisicaoInsumo, por: UsuarioResumo, detalhe?: string): EventoRequisicaoInsumo {
    return { acao, por, em: agoraISO(), detalhe };
  }

  private mudar(id: string, campos: Partial<RequisicaoInsumo>, acao: AcaoRequisicaoInsumo, detalhe: string): void {
    this.mudarComo(this.eu(), id, campos, acao, detalhe);
  }

  private mudarComo(por: UsuarioResumo, id: string, campos: Partial<RequisicaoInsumo>, acao: AcaoRequisicaoInsumo, detalhe: string): void {
    const ev = this.evento(acao, por, detalhe);
    this.requisicoes.update((lista) =>
      lista.map((r) => (r.id === id ? { ...r, ...campos, historico: [...r.historico, ev] } : r)),
    );
  }

  private proximoProtocolo(): string {
    const ano = new Date().getFullYear();
    const maior = this.requisicoes()
      .map((r) => /^REQ-(\d{4})-(\d{4})$/.exec(r.protocolo))
      .filter((m): m is RegExpExecArray => !!m && Number(m[1]) === ano)
      .reduce((max, m) => Math.max(max, Number(m[2])), 0);
    return `REQ-${ano}-${String(maior + 1).padStart(4, '0')}`;
  }
}

/** Requisições de exemplo: uma de cada situação que a coordenação precisa tratar. */
export function criarRequisicoesDemo(): RequisicaoInsumo[] {
  const ano = new Date().getFullYear();
  const hoje = hojeISO();
  const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const coord = resumoDemo('usr-admin');
  const base = (
    n: number,
    insumo: RequisicaoInsumo['insumo'],
    quem: string,
    quantidade: number,
    dataUso: string,
    localId: string,
    finalidade: string,
    turma: string,
    criadaHa: number,
  ): RequisicaoInsumo => {
    const solicitante = resumoDemo(quem);
    return {
      id: `req${n}`,
      protocolo: `REQ-${ano}-${String(n).padStart(4, '0')}`,
      insumo,
      solicitante,
      quantidade,
      dataUso,
      localId,
      turma,
      finalidade,
      status: 'pendente',
      criadaEm: horas(criadaHa),
      historico: [
        {
          acao: 'solicitada',
          por: solicitante,
          em: horas(criadaHa),
          detalhe: `${formatarQuantidade(quantidade)} ${NOME_UNIDADE[insumo.unidadeMedida]} para ${nomeLocal(localId)}`,
        },
      ],
    };
  };
  const recusada = base(1, { id: 'ins-pilhas', nome: 'Pilhas AA', unidadeMedida: 'un' }, 'usr-maria', 8, hoje, 'auditorio', 'Microfones sem fio da palestra do dia', 'Eventos', 30);
  const aprovada = base(2, { id: 'ins-jumpers', nome: 'Jumpers macho-macho', unidadeMedida: 'pct' }, 'usr-professor', 1, hoje, 'lab-eletronica', 'Montagem de circuitos na aula de eletrônica básica', '2º módulo', 20);
  const pendente1 = base(3, { id: 'ins-papel', nome: 'Papel A4 75 g', unidadeMedida: 'pct' }, 'usr-ana', 2, somarDias(hoje, 1), 'sala-102', 'Impressão das avaliações bimestrais do 1º ano', '1º ano A', 3);
  const pendente2 = base(4, { id: 'ins-resistores', nome: 'Resistores sortidos', unidadeMedida: 'pct' }, 'usr-carlos', 1, somarDias(hoje, 2), 'lab-eletronica', 'Prática de Lei de Ohm com a turma de eletrônica', '3º módulo', 1);
  return [
    pendente2,
    pendente1,
    {
      ...aprovada,
      status: 'aprovada',
      codigoRetirada: 'J5P7RQ',
      historico: [...aprovada.historico, { acao: 'aprovada', por: coord, em: horas(18), detalhe: '1 pacote(s) reservados' }],
    },
    {
      ...recusada,
      status: 'recusada',
      motivo: 'Use as pilhas recarregáveis do auditório, que já estão carregadas.',
      historico: [
        ...recusada.historico,
        { acao: 'recusada', por: coord, em: horas(28), detalhe: 'Motivo: Use as pilhas recarregáveis do auditório, que já estão carregadas.' },
      ],
    },
  ];
}
