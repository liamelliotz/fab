import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoriaEquipamento } from '../../../core/models/equipamento.model';
import { AdminEquipamentosStore, CATEGORIAS } from './admin-equipamentos.store';

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

  readonly form = this.fb.group({
    nome: ['', Validators.required],
    codigoPatrimonio: ['', Validators.required],
    categoria: ['outros' as CategoriaEquipamento, Validators.required],
    descricao: [''],
    localizacao: ['', Validators.required],
    quantidadeTotal: [1, [Validators.required, Validators.min(1)]],
    requerTreinamento: [false],
  });

  constructor() {
    if (this.id) {
      const item = this.store.buscarPorId(this.id);
      if (!item) {
        this.router.navigate(['/admin/equipamentos']);
        return;
      }
      this.form.patchValue({
        nome: item.nome,
        codigoPatrimonio: item.codigoPatrimonio,
        categoria: item.categoria,
        descricao: item.descricao,
        localizacao: item.localizacao,
        quantidadeTotal: item.quantidadeTotal,
        requerTreinamento: item.requerTreinamento,
      });
    }
  }

  salvar(): void {
    this.erroCodigo.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dados = this.form.getRawValue();
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

    this.router.navigate(['/admin/equipamentos']);
  }
}