import { Injectable, signal } from '@angular/core';
import {
  CategoriaEquipamento,
  CriarEquipamentoDTO,
  Equipamento,
} from '../../../core/models/equipamento.model';

export const CATEGORIAS: { valor: CategoriaEquipamento; nome: string }[] = [
  { valor: 'ferramenta', nome: 'Ferramenta' },
  { valor: 'eletronico', nome: 'Eletrônico' },
  { valor: 'impressora_3d', nome: 'Impressora 3D' },
  { valor: 'corte_laser', nome: 'Corte a laser' },
  { valor: 'consumivel', nome: 'Consumível' },
  { valor: 'outros', nome: 'Outros' },
];

// Dados de exemplo até o backend/service existir
const EQUIPAMENTOS_MOCK: Equipamento[] = [
  {
    id: '1',
    nome: 'Multímetro Digital Minipa ET-1002',
    descricao: 'Multímetro de bancada, 600 V.',
    codigoPatrimonio: 'PAT-0001',
    categoria: 'eletronico',
    status: 'disponivel',
    localizacao: 'Bancada 03 - Gaveteiro B',
    requerTreinamento: false,
    quantidadeDisponivel: 4,
    quantidadeTotal: 5,
    criadoEm: '2026-08-01',
  },
  {
    id: '2',
    nome: 'Impressora 3D Ender 3 V2',
    descricao: 'Impressora FDM, mesa 220x220 mm.',
    codigoPatrimonio: 'PAT-0002',
    categoria: 'impressora_3d',
    status: 'disponivel',
    localizacao: 'Sala de prototipagem',
    requerTreinamento: true,
    quantidadeDisponivel: 2,
    quantidadeTotal: 2,
    criadoEm: '2026-08-03',
  },
  {
    id: '3',
    nome: 'Parafusadeira Bosch 12 V',
    descricao: 'Parafusadeira sem fio com 2 baterias.',
    codigoPatrimonio: 'PAT-0003',
    categoria: 'ferramenta',
    status: 'emprestado',
    localizacao: 'Armário 01',
    requerTreinamento: false,
    quantidadeDisponivel: 0,
    quantidadeTotal: 1,
    criadoEm: '2026-08-10',
  },
  {
    id: '4',
    nome: 'Cortadora a laser CO2 40 W',
    descricao: 'Área de corte 300x200 mm.',
    codigoPatrimonio: 'PAT-0004',
    categoria: 'corte_laser',
    status: 'inativo',
    localizacao: 'Sala de corte',
    requerTreinamento: true,
    quantidadeDisponivel: 0,
    quantidadeTotal: 1,
    criadoEm: '2026-08-12',
  },
  {
    id: '5',
    nome: 'Filamento PLA 1,75 mm (1 kg)',
    descricao: 'Rolo de filamento PLA, cores variadas.',
    codigoPatrimonio: 'PAT-0005',
    categoria: 'consumivel',
    status: 'disponivel',
    localizacao: 'Estante 02',
    requerTreinamento: false,
    quantidadeDisponivel: 12,
    quantidadeTotal: 15,
    criadoEm: '2026-09-01',
  },
];

@Injectable({ providedIn: 'root' })
export class AdminEquipamentosStore {
  readonly itens = signal<Equipamento[]>(EQUIPAMENTOS_MOCK);

  buscarPorId(id: string): Equipamento | undefined {
    return this.itens().find((e) => e.id === id);
  }

  // Verdadeiro se o código já pertence a outro equipamento
  codigoExiste(codigo: string, ignorarId?: string): boolean {
    const alvo = codigo.trim().toLowerCase();
    return this.itens().some(
      (e) => e.id !== ignorarId && e.codigoPatrimonio.trim().toLowerCase() === alvo,
    );
  }

  cadastrar(dto: CriarEquipamentoDTO): void {
    const novo: Equipamento = {
      ...dto,
      id: crypto.randomUUID(),
      status: 'disponivel',
      quantidadeDisponivel: dto.quantidadeTotal,
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    this.itens.update((lista) => [...lista, novo]);
  }

  atualizar(id: string, dados: Partial<Omit<Equipamento, 'id'>>): void {
    const hoje = new Date().toISOString().slice(0, 10);
    this.itens.update((lista) =>
      lista.map((e) => (e.id === id ? { ...e, ...dados, atualizadoEm: hoje } : e)),
    );
  }

  // Desativa (inativo) ou reativa (disponivel). Item emprestado não muda.
  alternarAtivo(id: string): void {
    const item = this.buscarPorId(id);
    if (!item || item.status === 'emprestado') return;
    this.atualizar(id, { status: item.status === 'inativo' ? 'disponivel' : 'inativo' });
  }
}