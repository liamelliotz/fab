import { Component, inject } from '@angular/core';
import { EmprestimoService } from '../../../core/services/emprestimo.service';
import { EquipamentoService } from '../../../core/services/equipamento.service';
import { InsumoService, NOME_UNIDADE } from '../../../core/services/insumo.service';
import { formatarData, hojeISO, somarDias } from '../../../core/utils/date.utils';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UtilizacaoMaterial {
  id: number;
  material: string;
  responsavel: string;
  data: string;
  quantidade: number;
  tipo: string;
}

@Component({
  selector: 'app-admin-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-relatorios.html',
  styleUrl: './admin-relatorios.css'
})
export class AdminRelatorios {
  private readonly emprestimos = inject(EmprestimoService);
  private readonly insumos = inject(InsumoService);
  private readonly equipamentos = inject(EquipamentoService);
  readonly data = formatarData;

  // Abre já com os últimos 30 dias (o usuário pode mudar e gerar de novo).
  dataInicial = somarDias(hojeISO(), -30);
  dataFinal = hojeISO();
  relatorioGerado = false;
  /** Mensagem de validação mostrada na própria tela (no lugar de alert). */
  erro = '';

  /**
   * Utilizações REAIS, tiradas dos registros: cada retirada no balcão (empréstimo) e cada
   * saída de insumo para uso em aula. Nada é digitado à mão aqui.
   */
  get utilizacoes(): UtilizacaoMaterial[] {
    const lista: Omit<UtilizacaoMaterial, 'id'>[] = [];
    for (const p of this.emprestimos.todas()) {
      for (const ev of p.historico.filter((h) => h.tipo === 'retirado')) {
        for (const item of p.itens) {
          lista.push({
            material: item.equipamento?.nome ?? this.equipamentos.buscarPorId(item.equipamentoId)?.nome ?? 'Equipamento',
            responsavel: p.responsavel.nome,
            data: ev.em.slice(0, 10),
            quantidade: item.quantidade,
            tipo: `Empréstimo · ${p.protocolo}`,
          });
        }
      }
    }
    for (const m of this.insumos.movimentacoes().filter((x) => x.motivo === 'uso_em_aula')) {
      lista.push({
        material: m.insumo.nome,
        responsavel: m.destinatario?.nome ?? m.responsavel.nome,
        data: m.ocorridaEm.slice(0, 10),
        quantidade: m.quantidade,
        tipo: `Insumo · em ${NOME_UNIDADE[m.insumo.unidadeMedida]}`,
      });
    }
    return lista
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((u, i) => ({ ...u, id: i + 1 }));
  }

  resultados: UtilizacaoMaterial[] = [];

  constructor() {
    this.gerarRelatorio();
  }

  gerarRelatorio(): void {
    this.erro = '';
    if (!this.dataInicial || !this.dataFinal) {
      this.erro = 'Informe a data inicial e a data final.';
      return;
    }

    if (this.dataInicial > this.dataFinal) {
      this.erro = 'A data inicial não pode ser maior que a data final.';
      return;
    }

    this.resultados = this.utilizacoes.filter(utilizacao =>
      utilizacao.data >= this.dataInicial &&
      utilizacao.data <= this.dataFinal
    );

    this.relatorioGerado = true;
  }

  limparRelatorio(): void {
    this.dataInicial = '';
    this.dataFinal = '';
    this.resultados = [];
    this.relatorioGerado = false;
    this.erro = '';
  }

  get totalRegistros(): number {
    return this.resultados.length;
  }

  get totalQuantidade(): number {
    return this.resultados.reduce(
      (total, item) => total + item.quantidade,
      0
    );
  }

  get materiaisDiferentes(): number {
    return new Set(
      this.resultados.map(item => item.material)
    ).size;
  }

  exportarCSV(): void {

    if (this.resultados.length === 0) {
      this.erro = 'Não existem dados para exportar.';
      return;
    }

    const cabecalho = [
      'ID',
      'Material',
      'Responsavel',
      'Data',
      'Quantidade',
      'Tipo'
    ];

    const linhas = this.resultados.map(item => [
      item.id,
      item.material,
      item.responsavel,
      formatarData(item.data),
      String(item.quantidade).replace('.', ','),
      item.tipo
    ]);

    const conteudo = [
      cabecalho,
      ...linhas
    ]
      .map(linha =>
        linha
          .map(valor => `"${String(valor).replace(/"/g, '""')}"`)
          .join(';')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF' + conteudo],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download =
      `relatorio-utilizacao-${this.dataInicial}-${this.dataFinal}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  }
}