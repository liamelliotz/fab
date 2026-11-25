import { Component, input, output, signal } from '@angular/core';
import { GravidadeAvaria, TipoAvaria } from '../../../core/models/manutencao.model';
import {
  EFEITO_GRAVIDADE,
  NOME_GRAVIDADE,
  NOME_TIPO_AVARIA,
} from '../../../core/services/manutencao.service';
import { reduzirFoto } from '../../../core/utils/foto.utils';

/** Os dados de uma avaria que este bloco edita. */
export interface DadosAvaria {
  tipoAvaria?: TipoAvaria;
  gravidade?: GravidadeAvaria;
  descricao?: string;
  foto?: string;
}

let proximoId = 0;

/**
 * Campos de uma avaria: tipo, gravidade (com o efeito de cada uma), descrição e foto opcional.
 * Usado no Balcão (devolução) e na Manutenção (registro direto).
 * Recebe os dados em `[dados]` e avisa cada mudança em `(mudou)` (só o campo alterado).
 */
@Component({
  selector: 'app-avaria-campos',
  standalone: true,
  templateUrl: './avaria-campos.html',
  styleUrl: './avaria-campos.css',
})
export class AvariaCampos {
  readonly dados = input.required<DadosAvaria>();
  readonly mudou = output<Partial<DadosAvaria>>();

  readonly id = `avaria-${proximoId++}`;
  readonly tipos = Object.entries(NOME_TIPO_AVARIA) as [TipoAvaria, string][];
  readonly gravidades = (['leve', 'moderada', 'grave'] as GravidadeAvaria[]).map((g) => ({
    valor: g,
    nome: NOME_GRAVIDADE[g],
    efeito: EFEITO_GRAVIDADE[g],
  }));
  readonly efeito = EFEITO_GRAVIDADE;

  readonly processandoFoto = signal(false);
  readonly erroFoto = signal('');

  escolherTipo(evento: Event): void {
    this.mudou.emit({ tipoAvaria: ((evento.target as HTMLSelectElement).value || undefined) as TipoAvaria });
  }

  escolherGravidade(g: GravidadeAvaria): void {
    this.mudou.emit({ gravidade: g });
  }

  escreverDescricao(evento: Event): void {
    this.mudou.emit({ descricao: (evento.target as HTMLTextAreaElement).value });
  }

  async escolherFoto(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = ''; // permite escolher a mesma foto de novo
    if (!arquivo) return;
    this.erroFoto.set('');
    this.processandoFoto.set(true);
    try {
      this.mudou.emit({ foto: await reduzirFoto(arquivo) });
    } catch (e) {
      this.erroFoto.set(e instanceof Error ? e.message : 'Não foi possível usar esta imagem.');
    } finally {
      this.processandoFoto.set(false);
    }
  }

  removerFoto(): void {
    this.mudou.emit({ foto: undefined });
  }
}
