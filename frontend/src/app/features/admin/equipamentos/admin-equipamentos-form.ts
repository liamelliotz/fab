import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { formatarMoeda, lerMoeda, moedaParaCampo, validarValorItem } from '../../../core/utils/moeda.utils';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoriaEquipamento } from '../../../core/models/equipamento.model';
import { AdminEquipamentosStore, CATEGORIAS } from './admin-equipamentos.store';

/** Aceita "2.899,00", "2899" ou "R$ 2.899,50"; recusa zero, negativo e valores absurdos. */
function valorValido(c: AbstractControl): ValidationErrors | null {
  const erro = validarValorItem(lerMoeda(c.value as string));
  return erro && c.value ? { valor: erro } : null;
}

@Component({
  selector: 'app-admin-equipamentos-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-equipamentos-form.html',
  styleUrl: './admin-equipamentos-form.css',
})
export class AdminEquipamentosForm {
  private readonly store = inject(AdminEquipamentosStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly categorias = CATEGORIAS;

  // Se a rota tem :id, estamos editando; senão, cadastrando
  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly editando = this.id !== null;

  readonly erroCodigo = signal('');
  readonly moeda = formatarMoeda;

  /** Valor total das unidades (quantidade × valor unitário), mostrado abaixo do campo. */
  valorTotal(): string | null {
    const v = lerMoeda(this.form.controls.valorUnitario.value);
    const q = Number(this.form.controls.quantidadeTotal.value);
    return v && q > 0 ? formatarMoeda(v * q) : null;
  }

  readonly form = this.fb.group({
    nome: ['', Validators.required],
    codigoPatrimonio: ['', Validators.required],
    categoria: ['outros' as CategoriaEquipamento, Validators.required],
    descricao: [''],
    localizacao: ['', Validators.required],
    quantidadeTotal: [1, [Validators.required, Validators.min(1)]],
    // Valor de UMA unidade (R$): a baixa e o valor do acervo são calculados a partir dele
    valorUnitario: ['', [Validators.required, valorValido]],
    // Impede que alguém fique com o material o ano todo (a solicitação respeita este limite)
    prazoMaximoDias: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
    requerTreinamento: [false],
    retiradaNoLocal: [false],
  });

  constructor() {
    if (this.id) {
      const item = this.store.buscarPorId(this.id);
      if (!item) {
        this.router.navigate(['/admin/inventario/equipamentos']);
        return;
      }
      this.form.patchValue({
        nome: item.nome,
        codigoPatrimonio: item.codigoPatrimonio,
        categoria: item.categoria,
        descricao: item.descricao,
        localizacao: item.localizacao,
        quantidadeTotal: item.quantidadeTotal,
        valorUnitario: moedaParaCampo(item.valorUnitario),
        prazoMaximoDias: item.prazoMaximoDias,
        requerTreinamento: item.requerTreinamento,
        retiradaNoLocal: !!item.retiradaNoLocal,
      });
    }
  }

  salvar(): void {
    this.erroCodigo.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { valorUnitario: valorTexto, ...resto } = this.form.getRawValue();
    const dados = { ...resto, valorUnitario: lerMoeda(valorTexto) as number };
    const codigo = dados.codigoPatrimonio.trim();

    if (this.store.codigoExiste(codigo, this.id ?? undefined)) {
      this.erroCodigo.set('Já existe um equipamento com este código patrimonial.');
      return;
    }

    if (this.id) {
      const atual = this.store.buscarPorId(this.id);
      if (atual) {
        // Ajusta a quantidade disponível conforme a mudança no total
        const diferenca = dados.quantidadeTotal - atual.quantidadeTotal;
        this.store.atualizar(this.id, {
          ...dados,
          codigoPatrimonio: codigo,
          quantidadeDisponivel: Math.max(0, atual.quantidadeDisponivel + diferenca),
        });
      }
    } else {
      this.store.cadastrar({ ...dados, codigoPatrimonio: codigo });
    }

    this.router.navigate(['/admin/inventario/equipamentos']);
  }
}