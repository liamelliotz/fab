import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Manutencao, StatusManutencao } from '../../../core/models/manutencao.model';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import {
  ManutencaoService,
  NOME_GRAVIDADE,
  NOME_STATUS_MANUTENCAO,
  NOME_TIPO_AVARIA,
} from '../../../core/services/manutencao.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatarData } from '../../../core/utils/date.utils';
import { AvariaCampos, DadosAvaria } from '../../../shared/components/avaria-campos/avaria-campos';
import { DialogoDirective } from '../../../shared/directives/dialogo.directive';

type Filtro = 'pendentes' | 'resolvidas' | 'todas';
type Acao = 'assistencia' | 'concluir' | 'baixa';

/**
 * Manutenção: avarias e faltas (extravios) registradas no balcão ou aqui mesmo.
 * Cada ocorrência mostra quem estava com o item. A coordenação manda para conserto,
 * marca como consertada/encontrada (a unidade volta ao estoque) ou dá baixa (sai do acervo).
 */
@Component({
  selector: 'app-admin-manutencao',
  standalone: true,
  imports: [RouterLink, AvariaCampos, DialogoDirective],
  templateUrl: './admin-manutencao.html',
  styleUrl: './admin-manutencao.css',
})
export class AdminManutencao {
  private readonly service = inject(ManutencaoService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly avisos = inject(NotificationService);

  readonly nomeTipo = NOME_TIPO_AVARIA;
  readonly nomeGravidade = NOME_GRAVIDADE;
  readonly nomeStatus = NOME_STATUS_MANUTENCAO;
  readonly data = (iso: string) => formatarData(iso.slice(0, 10));

  readonly filtro = signal<Filtro>('pendentes');

  readonly pendentes = this.service.pendentes;
  readonly resolvidas = computed(() =>
    this.service.todas().filter((m) => m.status === 'concluida' || m.status === 'baixa'),
  );
  readonly lista = computed(() => {
    const f = this.filtro();
    return f === 'pendentes' ? this.pendentes() : f === 'resolvidas' ? this.resolvidas() : this.service.todas();
  });

  // Indicadores
  readonly unidadesBloqueadas = computed(() => this.pendentes().reduce((s, m) => s + m.quantidade, 0));
  readonly emConserto = computed(() => this.pendentes().filter((m) => m.status === 'em_assistencia').length);
  readonly faltasAbertas = computed(() =>
    this.pendentes().filter((m) => m.tipo === 'extravio').reduce((s, m) => s + m.quantidade, 0),
  );
  readonly totalResolvidas = computed(() => this.resolvidas().length);

  // Diálogo de ação (conserto, conclusão ou baixa)
  readonly acao = signal<{ tipo: Acao; alvo: Manutencao } | null>(null);
  readonly textoAcao = signal('');
  readonly erroAcao = signal('');

  // Foto ampliada
  readonly fotoAberta = signal<string | null>(null);

  // Registro direto (item encontrado com problema no laboratório)
  readonly registrando = signal(false);
  readonly novoEquipamentoId = signal('');
  readonly novaQuantidade = signal(1);
  readonly novaAvaria = signal<DadosAvaria>({});
  readonly erroNovo = signal('');
  /** Só dá para registrar em unidade que está no laboratório (disponível). */
  readonly opcoesEquipamento = computed(() =>
    this.equipamentos.catalogo().filter((e) => e.quantidadeDisponivel > 0),
  );
  readonly maximoNovo = computed(
    () => this.equipamentos.buscarPorId(this.novoEquipamentoId())?.quantidadeDisponivel ?? 1,
  );

  foto(m: Manutencao): string | undefined {
    return m.temFoto ? this.service.foto(m.id) : undefined;
  }

  pendente(m: Manutencao): boolean {
    return m.status === 'aberta' || m.status === 'em_assistencia';
  }

  /** Classe de cor do selo: grave/moderada/leve para avaria e "falta" para extravio. */
  selo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'falta' : (m.gravidade ?? 'moderada');
  }

  rotuloSelo(m: Manutencao): string {
    return m.tipo === 'extravio' ? 'Falta' : `Avaria ${NOME_GRAVIDADE[m.gravidade ?? 'moderada'].toLowerCase()}`;
  }

  corStatus(s: StatusManutencao): string {
    return s;
  }

  disponibilidade(m: Manutencao): string {
    const e = this.equipamentos.buscarPorId(m.equipamentoId);
    if (!e) return '';
    const est = this.equipamentos.estoque(e);
    return `${est.disponiveis} de ${est.total} disponíveis` + (est.emManutencao ? ` · ${est.emManutencao} em manutenção` : '');
  }

  // ---------- Ações ----------

  abrirAcao(tipo: Acao, alvo: Manutencao): void {
    this.textoAcao.set(tipo === 'assistencia' ? (alvo.assistencia ?? '') : '');
    this.erroAcao.set('');
    this.acao.set({ tipo, alvo });
  }

  fecharAcao(): void {
    this.acao.set(null);
  }

  escreverAcao(evento: Event): void {
    this.textoAcao.set((evento.target as HTMLInputElement | HTMLTextAreaElement).value);
    this.erroAcao.set('');
  }

  confirmarAcao(): void {
    const a = this.acao();
    if (!a) return;
    const { tipo, alvo } = a;
    const erro =
      tipo === 'assistencia'
        ? this.service.enviarParaAssistencia(alvo.id, this.textoAcao())
        : tipo === 'concluir'
          ? this.service.concluir(alvo.id, this.textoAcao())
          : this.service.darBaixa(alvo.id, this.textoAcao());
    if (erro) {
      this.erroAcao.set(erro);
      return;
    }
    this.acao.set(null);
    if (tipo === 'assistencia') {
      this.avisos.info(`${alvo.protocolo}: ${alvo.equipamento} enviado para conserto.`);
    } else if (tipo === 'concluir') {
      this.avisos.sucesso(`${alvo.equipamento}: ${alvo.quantidade} unidade(s) de volta ao estoque.`);
    } else {
      this.avisos.aviso(`${alvo.equipamento}: baixa de ${alvo.quantidade} unidade(s) no acervo.`);
    }
  }

  // ---------- Registro direto ----------

  abrirRegistro(): void {
    const primeiro = this.opcoesEquipamento()[0];
    this.novoEquipamentoId.set(primeiro?.id ?? '');
    this.novaQuantidade.set(1);
    this.novaAvaria.set({});
    this.erroNovo.set('');
    this.registrando.set(true);
  }

  escolherEquipamento(evento: Event): void {
    this.novoEquipamentoId.set((evento.target as HTMLSelectElement).value);
    this.novaQuantidade.set(1);
  }

  mudarQuantidadeNova(delta: number): void {
    this.novaQuantidade.update((q) => Math.max(1, Math.min(this.maximoNovo(), q + delta)));
  }

  mudarNovaAvaria(mudanca: Partial<DadosAvaria>): void {
    this.novaAvaria.update((a) => ({ ...a, ...mudanca }));
    this.erroNovo.set('');
  }

  salvarRegistro(): void {
    const eq = this.equipamentos.buscarPorId(this.novoEquipamentoId());
    if (!eq) {
      this.erroNovo.set('Escolha o equipamento.');
      return;
    }
    const a = this.novaAvaria();
    const dados = {
      tipo: 'avaria' as const,
      quantidade: this.novaQuantidade(),
      tipoAvaria: a.tipoAvaria,
      gravidade: a.gravidade,
      descricao: a.descricao ?? '',
    };
    const erro = this.service.validar(dados, eq.nome);
    if (erro) {
      this.erroNovo.set(erro);
      return;
    }
    if (dados.quantidade > eq.quantidadeDisponivel) {
      this.erroNovo.set(`Só há ${eq.quantidadeDisponivel} unidade(s) de "${eq.nome}" no laboratório.`);
      return;
    }
    const m = this.service.registrar({ ...dados, equipamentoId: eq.id, foto: a.foto, origem: 'estoque' });
    this.registrando.set(false);
    this.filtro.set(m.bloqueia ? 'pendentes' : 'todas');
    this.avisos.sucesso(
      m.bloqueia
        ? `${m.protocolo} registrada: ${eq.nome} bloqueado para empréstimo.`
        : `${m.protocolo} registrada (avaria leve): ${eq.nome} continua disponível.`,
    );
  }
}
