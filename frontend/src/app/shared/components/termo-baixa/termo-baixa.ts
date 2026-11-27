import { Component, computed, input, output } from '@angular/core';
import { NOME_ESCOLA_MODELO } from '../../../core/constants/escola-modelo.constants';
import { Manutencao } from '../../../core/models/manutencao.model';
import { NOME_GRAVIDADE, NOME_MOTIVO_BAIXA, NOME_TIPO_AVARIA } from '../../../core/services/manutencao.service';
import { escaparHtml } from '../../../core/utils/arquivo.utils';
import { formatarDataHora } from '../../../core/utils/date.utils';
import { DialogoDirective } from '../../directives/dialogo.directive';

/**
 * TERMO DE BAIXA PATRIMONIAL: o documento de auditoria gerado quando uma unidade sai do acervo.
 * Mostra o bem, a ocorrência de origem, o motivo, o parecer, os documentos, quem estava com o
 * item e quem autorizou. "Imprimir" abre uma página limpa, pronta para assinar e arquivar.
 */
@Component({
  selector: 'app-termo-baixa',
  standalone: true,
  imports: [DialogoDirective],
  templateUrl: './termo-baixa.html',
  styleUrl: './termo-baixa.css',
})
export class TermoBaixa {
  readonly ocorrencia = input.required<Manutencao>();
  readonly fechar = output<void>();

  readonly escola = NOME_ESCOLA_MODELO;
  readonly dataHora = formatarDataHora;
  readonly nomeMotivo = NOME_MOTIVO_BAIXA;
  readonly baixa = computed(() => this.ocorrencia().baixa);

  readonly origem = computed(() => {
    const m = this.ocorrencia();
    if (m.tipo === 'extravio') return 'Extravio (unidade não devolvida)';
    const partes = [m.tipoAvaria ? NOME_TIPO_AVARIA[m.tipoAvaria] : 'Avaria', m.gravidade ? `gravidade ${NOME_GRAVIDADE[m.gravidade].toLowerCase()}` : ''];
    return partes.filter(Boolean).join(' · ');
  });

  readonly valor = computed(() => {
    const v = this.baixa()?.valorEstimado;
    return v === undefined ? 'Não informado' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  });

  imprimir(): void {
    const m = this.ocorrencia();
    const b = this.baixa();
    if (!b || typeof window === 'undefined') return;
    const linha = (rotulo: string, valor: string | undefined) =>
      `<tr><th>${escaparHtml(rotulo)}</th><td>${escaparHtml(valor || '—')}</td></tr>`;
    const historico = m.historico
      .map((p) => `<li><b>${escaparHtml(formatarDataHora(p.em))}</b> · ${escaparHtml(p.texto)} <i>(${escaparHtml(p.por.nome)})</i></li>`)
      .join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(b.protocolo)} — Termo de baixa</title>
<style>
body{font-family:Inter,Arial,sans-serif;color:#1f2937;margin:32px;font-size:13px;line-height:1.45}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 8px;color:#0b3d2e;border-bottom:1px solid #d1d5db;padding-bottom:4px}
.topo{display:flex;justify-content:space-between;border-bottom:3px solid #0b3d2e;padding-bottom:12px}
.topo small{color:#6b7280}.prot{font-size:18px;font-weight:700;color:#b91c1c;text-align:right}
table{width:100%;border-collapse:collapse}th{width:34%;text-align:left;color:#4b5563;font-weight:600;padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
td{padding:6px 8px;border-bottom:1px solid #e5e7eb}ol{padding-left:18px}li{margin-bottom:4px}
.assin{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:56px}.assin div{border-top:1px solid #111;padding-top:6px;text-align:center;font-size:12px}
.nota{margin-top:24px;font-size:11px;color:#6b7280}
</style></head><body>
<div class="topo"><div><h1>Termo de baixa patrimonial</h1><small>${escaparHtml(this.escola)} · Sistema FAB</small></div>
<div class="prot">${escaparHtml(b.protocolo)}<br><small>${escaparHtml(formatarDataHora(b.em))}</small></div></div>
<h2>Bem baixado</h2><table>
${linha('Equipamento', m.equipamento)}${linha('Patrimônio', m.codigoPatrimonio)}${linha('Quantidade', `${m.quantidade} unidade(s)${m.identificacao ? ' · ' + m.identificacao : ''}`)}
${linha('Ocorrência de origem', `${m.protocolo} · ${this.origem()}`)}${linha('Descrição registrada', m.descricao)}
${linha('Estava com', m.responsavel ? `${m.responsavel.nome}${m.protocoloEmprestimo ? ` (pedido ${m.protocoloEmprestimo})` : ''}` : 'Encontrado no laboratório (sem empréstimo)')}
</table>
<h2>Fundamentação</h2><table>
${linha('Motivo', NOME_MOTIVO_BAIXA[b.motivo])}${linha('Parecer técnico / relato', b.parecer)}
${linha('Laudo da assistência', b.laudo)}${linha('Processo ou boletim de ocorrência', b.processo)}
${linha('Valor estimado do bem', this.valor())}${linha('Responsável informado da baixa', m.responsavel ? (b.responsavelCiente ? 'Sim' : 'Não') : 'Não se aplica')}
${linha('Testemunha da conferência', b.testemunha)}${linha('Autorizado por', `${b.autorizadoPor.nome} (coordenação)`)}
</table>
<h2>Histórico da ocorrência</h2><ol>${historico}</ol>
<div class="assin"><div>${escaparHtml(b.autorizadoPor.nome)}<br>Coordenação</div><div>${escaparHtml(b.testemunha || 'Testemunha')}<br>Conferência</div></div>
<p class="nota">Documento gerado pelo FAB a partir de registros que não podem ser editados nem apagados. Termo ${escaparHtml(b.protocolo)}.</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const janela = window.open('', '_blank', 'width=900,height=1000');
    if (!janela) return;
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  }
}
