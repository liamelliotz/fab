import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { InsumoService } from './insumo.service';
import { ManutencaoService } from './manutencao.service';
import { UsuarioService } from './usuario.service';

/**
 * Ações da DEMONSTRAÇÃO (só existem enquanto o app roda sem backend).
 *
 * `restaurar()` volta tudo ao estado inicial: usuários, equipamentos (com o estoque),
 * pedidos, avisos, avarias (ocorrências de manutenção, fotos e termos de baixa) e insumos. As outras abas abertas recebem os dados novos na hora.
 * A sessão (quem está logado nesta aba) não muda.
 */
@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly usuarios = inject(UsuarioService);
  private readonly equipamentos = inject(EquipamentoService);
  private readonly emprestimos = inject(EmprestimoService);
  private readonly manutencoes = inject(ManutencaoService);
  private readonly insumos = inject(InsumoService);

  /** true quando o app está no modo demonstração (sem servidor). */
  readonly ativo = inject(AuthService).modoDemo;

  restaurar(): void {
    if (!this.ativo) return;
    this.usuarios.reiniciar();
    this.equipamentos.reiniciar();
    this.emprestimos.reiniciar();
    this.manutencoes.reiniciar();
    this.insumos.reiniciar();
  }
}
