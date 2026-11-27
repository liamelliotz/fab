import { RouterLink } from '@angular/router';
import { InventarioAbas } from '../../shared/components/inventario-abas/inventario-abas';
import { Component, computed, inject, signal } from '@angular/core';
import { LOCAIS_DE_USO } from '../../core/constants/escola-modelo.constants';
import { CategoriaInsumo, Insumo } from '../../core/models/insumo.model';
import { InsumoService, NOME_CATEGORIA_INSUMO, NOME_UNIDADE, formatarQuantidade } from '../../core/services/insumo.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ANTECEDENCIA_MAXIMA_DIAS,
  MINIMO_TEXTO,
  RequisicaoInsumoService,
  aceitaFracao,
} from '../../core/services/requisicao-insumo.service';
import { hojeISO, somarDias } from '../../core/utils/date.utils';
import { DialogoDirective } from '../../shared/directives/dialogo.directive';

interface FormPedido {
  quantidade: string;
  dataUso: string;
  localId: string;
  turma: string;
  finalidade: string;
}

/**
 * INSUMOS (professor): materiais de CONSUMO. O professor informa quanto prevê usar, em que dia,
 * onde e para quê; a coordenação aprova e entrega no balcão. Diferente de Materiais (empréstimo),
 * o insumo não volta, só a sobra.
 */
@Component({
  selector: 'app-insumos-professor',
  standalone: true,
  imports: [DialogoDirective, InventarioAbas, RouterLink],
  templateUrl: './insumos-professor.html',
  styleUrl: './insumos-professor.css',
})
export class InsumosProfessor {
  private readonly insumos = inject(InsumoService);
  readonly requisicoes = inject(RequisicaoInsumoService);
  private readonly avisos = inject(NotificationService);

  readonly nomeCategoria = NOME_CATEGORIA_INSUMO;
  readonly nomeUnidade = NOME_UNIDADE;
  readonly categorias = Object.keys(NOME_CATEGORIA_INSUMO) as CategoriaInsumo[];
  readonly locais = LOCAIS_DE_USO;
  readonly qtd = formatarQuantidade;
  readonly minimo = MINIMO_TEXTO;
  readonly hoje = hojeISO();
  readonly dataMaxima = somarDias(hojeISO(), ANTECEDENCIA_MAXIMA_DIAS);

  readonly busca = signal('');
  readonly categoria = signal<CategoriaInsumo | ''>('');

  readonly catalogo = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.insumos
      .ativos()
      .filter((i) => !this.categoria() || i.categoria === this.categoria())
      .filter((i) => !termo || `${i.nome} ${i.descricao ?? ''}`.toLowerCase().includes(termo))
      .map((i) => ({ insumo: i, disponivel: this.requisicoes.disponivel(i.id) }))
      .sort((a, b) => a.insumo.nome.localeCompare(b.insumo.nome));
  });

  // ---------- Pedir ----------
  readonly pedindo = signal<{ insumo: Insumo; disponivel: number; form: FormPedido } | null>(null);
  readonly erroPedido = signal('');

  readonly faltamFinalidade = computed(() => {
    const p = this.pedindo();
    return p ? Math.max(0, this.minimo - p.form.finalidade.trim().length) : 0;
  });

  situacao(disponivel: number, i: Insumo): 'ok' | 'pouco' | 'sem' {
    if (disponivel <= 0) return 'sem';
    return disponivel <= i.estoqueMinimo ? 'pouco' : 'ok';
  }

  passo(i: Insumo): string {
    return aceitaFracao(i.unidadeMedida) ? '0.1' : '1';
  }

  abrirPedido(i: Insumo, disponivel: number): void {
    this.erroPedido.set('');
    this.pedindo.set({
      insumo: i,
      disponivel,
      form: { quantidade: '1', dataUso: this.hoje, localId: '', turma: '', finalidade: '' },
    });
  }

  campo(nome: keyof FormPedido, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.pedindo.update((p) => (p ? { ...p, form: { ...p.form, [nome]: valor } } : p));
    this.erroPedido.set('');
  }

  enviarPedido(): void {
    const p = this.pedindo();
    if (!p) return;
    const r = this.requisicoes.solicitar({
      insumoId: p.insumo.id,
      quantidade: Number(p.form.quantidade.replace(',', '.')),
      dataUso: p.form.dataUso,
      localId: p.form.localId,
      turma: p.form.turma,
      finalidade: p.form.finalidade,
    });
    if (!r.ok) {
      this.erroPedido.set(r.erro);
      return;
    }
    this.avisos.sucesso(`Requisição ${r.valor.protocolo} enviada. Acompanhe em Meus pedidos › Insumos.`);
    this.pedindo.set(null);
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }
}
