import { Component, computed, inject, signal } from '@angular/core';
import { AssistenciaTecnica, DadosAssistencia } from '../../../../core/models/assistencia.model';
import { CategoriaEquipamento } from '../../../../core/models/equipamento.model';
import { AssistenciaService, formatarCnpj, formatarTelefone } from '../../../../core/services/assistencia.service';
import { CATEGORIAS } from '../../../../core/services/equipamento.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatarData, hojeISO, somarDias } from '../../../../core/utils/date.utils';
import { DialogoDirective } from '../../../../shared/directives/dialogo.directive';

const VAZIO: DadosAssistencia = {
  nomeFantasia: '', razaoSocial: '', cnpj: '', telefone: '', email: '', endereco: '',
  especialidades: [], credenciadaAte: '', contrato: '',
};

/**
 * ASSISTÊNCIAS CREDENCIADAS: quem pode consertar os equipamentos da escola.
 * Só aparecem para escolha na manutenção as ativas, em dia e da categoria do equipamento.
 */
@Component({
  selector: 'app-assistencias-credenciadas',
  standalone: true,
  imports: [DialogoDirective],
  templateUrl: './assistencias-credenciadas.html',
  styleUrl: './assistencias-credenciadas.css',
})
export class AssistenciasCredenciadas {
  readonly service = inject(AssistenciaService);
  private readonly avisos = inject(NotificationService);

  readonly categorias = CATEGORIAS;
  readonly cnpj = formatarCnpj;
  readonly telefone = formatarTelefone;
  readonly data = formatarData;
  readonly hoje = hojeISO();

  readonly lista = computed(() =>
    [...this.service.todas()].sort(
      (a, b) => Number(this.service.emDia(b)) - Number(this.service.emDia(a)) || a.nomeFantasia.localeCompare(b.nomeFantasia),
    ),
  );

  readonly editando = signal<{ id: string | null; dados: DadosAssistencia } | null>(null);
  readonly erro = signal('');

  nomeCategoria(c: CategoriaEquipamento): string {
    return this.categorias.find((x) => x.valor === c)?.nome ?? c;
  }

  situacao(a: AssistenciaTecnica): { texto: string; classe: string } {
    if (!a.ativa) return { texto: 'Descredenciada', classe: 'off' };
    if (a.credenciadaAte < this.hoje) return { texto: 'Credenciamento vencido', classe: 'vencida' };
    if (a.credenciadaAte <= somarDias(this.hoje, 30)) return { texto: 'Vence em breve', classe: 'aviso' };
    return { texto: 'Credenciada', classe: 'ok' };
  }

  novo(): void {
    this.erro.set('');
    this.editando.set({ id: null, dados: { ...VAZIO, credenciadaAte: somarDias(this.hoje, 365) } });
  }

  editar(a: AssistenciaTecnica): void {
    this.erro.set('');
    const { id, ativa, criadaEm, atualizadaEm, ...dados } = a;
    void ativa; void criadaEm; void atualizadaEm;
    this.editando.set({
      id,
      dados: { ...dados, cnpj: formatarCnpj(dados.cnpj), telefone: formatarTelefone(dados.telefone), endereco: dados.endereco ?? '', contrato: dados.contrato ?? '' },
    });
  }

  campo(nome: keyof DadosAssistencia, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.editando.update((e) => (e ? { ...e, dados: { ...e.dados, [nome]: valor } } : e));
    this.erro.set('');
  }

  alternarEspecialidade(c: CategoriaEquipamento): void {
    this.editando.update((e) => {
      if (!e) return e;
      const tem = e.dados.especialidades.includes(c);
      const especialidades = tem ? e.dados.especialidades.filter((x) => x !== c) : [...e.dados.especialidades, c];
      return { ...e, dados: { ...e.dados, especialidades } };
    });
    this.erro.set('');
  }

  salvar(): void {
    const e = this.editando();
    if (!e) return;
    if (e.id) {
      const erro = this.service.atualizar(e.id, e.dados);
      if (erro) return this.erro.set(erro);
      this.avisos.sucesso(`${e.dados.nomeFantasia.trim()} atualizada.`);
    } else {
      const r = this.service.cadastrar(e.dados);
      if (!r.ok) return this.erro.set(r.erro);
      this.avisos.sucesso(`${r.valor.nomeFantasia} credenciada.`);
    }
    this.editando.set(null);
  }

  alternar(a: AssistenciaTecnica): void {
    this.service.alternarAtiva(a.id);
    this.avisos.info(a.ativa ? `${a.nomeFantasia} descredenciada. Não recebe novos equipamentos.` : `${a.nomeFantasia} credenciada de novo.`);
  }
}
