import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Emprestimo } from '../../../core/models/emprestimo.model';
import { EmprestimoAdminService, mensagemErroAdmin } from '../../../core/services/emprestimo-admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { normalizarCodigo } from '../../../core/utils/codigo.utils';
import { formatarData } from '../../../core/utils/date.utils';

type Aba = 'retirada' | 'devolucao';
@Component({ selector: 'app-admin-balcao', standalone: true, imports: [RouterLink],
  templateUrl: './admin-balcao.html', styleUrl: './admin-balcao.css' })
export class AdminBalcao {
  readonly service = inject(EmprestimoAdminService);
  private readonly notificacoes = inject(NotificationService);
  private readonly destroy = inject(DestroyRef);
  private consulta?: Subscription;
  private codigoConferido = '';
  readonly data = formatarData;
  readonly aba = signal<Aba>('retirada');
  readonly codigo = signal('');
  readonly erro = signal('');
  readonly alvo = signal<Emprestimo | null>(null);
  readonly houveAvaria = signal(false);
  readonly observacoes = signal('');
  readonly consultando = signal(false);
  readonly salvando = signal(false);
  constructor() { this.destroy.onDestroy(() => this.consulta?.unsubscribe()); }
  itens(s: Emprestimo): string { return this.service.resumoItens(s); }
  atrasado(s: Emprestimo): boolean { return s.status === 'atrasado'; }
  trocarAba(aba: Aba): void {
    if (this.salvando()) return;
    this.limpar(); this.aba.set(aba);
  }
  atualizarCodigo(e: Event): void { this.codigo.set((e.target as HTMLInputElement).value); }
  atualizarObservacoes(e: Event): void { this.observacoes.set((e.target as HTMLTextAreaElement).value); }
  atualizarAvaria(e: Event): void { this.houveAvaria.set((e.target as HTMLInputElement).checked); }
  buscar(): void {
    if (this.consultando() || this.salvando()) return;
    this.erro.set(''); this.alvo.set(null); this.codigoConferido = '';
    const texto = this.codigo().trim(); const codigo = normalizarCodigo(texto);
    const marcador = /^FAB:([RD]):/i.exec(texto)?.[1]?.toUpperCase();
    if ((marcador === 'R' && this.aba() !== 'retirada') || (marcador === 'D' && this.aba() !== 'devolucao')) {
      this.erro.set('Este QR pertence à outra operação. Troque a aba antes de conferir.'); return;
    }
    if (!codigo) { this.erro.set('Digite ou escaneie o código.'); return; }
    this.consultando.set(true);
    this.consulta = this.service.consultarCodigo(texto).pipe(finalize(() => this.consultando.set(false))).subscribe({
      next: (resposta) => {
        if (resposta.tipo !== this.aba()) {
          this.erro.set(`Este é um código de ${resposta.tipo}. Use a aba correspondente.`); return;
        }
        this.codigoConferido = codigo; this.alvo.set(resposta.emprestimo);
      }, error: (erro) => this.erro.set(mensagemErroAdmin(erro)),
    });
  }
  limpar(): void {
    this.consulta?.unsubscribe(); this.codigoConferido = ''; this.codigo.set(''); this.erro.set('');
    this.alvo.set(null); this.houveAvaria.set(false); this.observacoes.set('');
  }
  confirmar(): void {
    if (!this.alvo() || !this.codigoConferido || this.salvando()) return;
    const devolucao = this.aba() === 'devolucao'; const avaria = this.houveAvaria();
    if (devolucao && avaria && !this.observacoes().trim()) {
      this.erro.set('Informe as observações da avaria.'); return;
    }
    this.erro.set(''); this.salvando.set(true);
    const operacao = devolucao ? this.service.devolver({ codigo: this.codigoConferido, houveAvaria: avaria,
      observacoes: this.observacoes() }) : this.service.retirar(this.codigoConferido);
    operacao.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.salvando.set(false))).subscribe({
      next: (s) => {
        this.notificacoes.sucesso(devolucao
          ? `Devolução registrada: ${s.protocolo}${avaria ? ' com avaria' : ''}.`
          : `Retirada registrada: ${s.protocolo} entregue a ${s.responsavel.nome}.`);
        this.limpar();
      }, error: (erro) => {
        this.erro.set(mensagemErroAdmin(erro));
        // Exige nova consulta após erro, inclusive quando outra pessoa já usou o código.
        this.alvo.set(null); this.codigoConferido = '';
      },
    });
  }
}
