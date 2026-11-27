import { Injectable, computed, effect, signal } from '@angular/core';
import { AssistenciaTecnica, DadosAssistencia } from '../models/assistencia.model';
import { CategoriaEquipamento } from '../models/equipamento.model';
import { Resultado, falha, sucesso } from '../models/resultado.model';
import { gravarJson, lerJson, ouvirOutrasAbas } from '../utils/armazenamento.utils';
import { agoraISO, hojeISO, somarDias } from '../utils/date.utils';

const CHAVE = 'fab_demo_v8_assistencias';

/** "12345678000195" → "12.345.678/0001-95" */
export function formatarCnpj(cnpj: string): string {
  const d = (cnpj ?? '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj;
}

/** "96991234567" → "(96) 99123-4567" */
export function formatarTelefone(tel: string): string {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return tel;
}

/** Confere os dois dígitos verificadores do CNPJ (Receita Federal). */
export function cnpjValido(cnpj: string): boolean {
  const d = (cnpj ?? '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = digito(d.slice(0, 12), p1);
  const d2 = digito(d.slice(0, 12) + d1, p2);
  return d.endsWith(`${d1}${d2}`);
}

/**
 * ASSISTÊNCIAS CREDENCIADAS (modo demonstração; mesmo contrato da futura API /assistencias).
 * Valida CNPJ, contato, especialidades e prazo do credenciamento.
 */
@Injectable({ providedIn: 'root' })
export class AssistenciaService {
  readonly todas = signal<AssistenciaTecnica[]>(lerJson<AssistenciaTecnica[]>(CHAVE) ?? criarAssistenciasDemo());

  /** Ativas e com credenciamento em dia. */
  readonly credenciadas = computed(() => this.todas().filter((a) => this.emDia(a)));

  constructor() {
    effect(() => gravarJson(CHAVE, this.todas()));
    ouvirOutrasAbas<AssistenciaTecnica[]>(CHAVE, (v) => v && this.todas.set(v));
  }

  buscarPorId(id: string): AssistenciaTecnica | undefined {
    return this.todas().find((a) => a.id === id);
  }

  emDia(a: AssistenciaTecnica): boolean {
    return a.ativa && a.credenciadaAte >= hojeISO();
  }

  /** Quem pode receber um equipamento desta categoria agora. */
  paraCategoria(categoria: CategoriaEquipamento | undefined): AssistenciaTecnica[] {
    return this.credenciadas()
      .filter((a) => !categoria || a.especialidades.includes(categoria))
      .sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia));
  }

  /** Por que esta assistência NÃO pode receber o equipamento (ou null se pode). */
  impedimento(a: AssistenciaTecnica | undefined, categoria?: CategoriaEquipamento): string | null {
    if (!a) return 'Escolha uma assistência credenciada.';
    if (!a.ativa) return `${a.nomeFantasia} está descredenciada.`;
    if (a.credenciadaAte < hojeISO()) return `O credenciamento de ${a.nomeFantasia} venceu. Renove antes de enviar.`;
    if (categoria && !a.especialidades.includes(categoria)) return `${a.nomeFantasia} não conserta esta categoria de equipamento.`;
    return null;
  }

  validar(dados: DadosAssistencia, ignorarId?: string): string | null {
    if ((dados.nomeFantasia ?? '').trim().length < 3) return 'Informe o nome da assistência.';
    if ((dados.razaoSocial ?? '').trim().length < 3) return 'Informe a razão social.';
    const cnpj = (dados.cnpj ?? '').replace(/\D/g, '');
    if (!cnpjValido(cnpj)) return 'CNPJ inválido. Confira os 14 números.';
    if (this.todas().some((a) => a.id !== ignorarId && a.cnpj === cnpj)) return 'Já existe uma assistência com este CNPJ.';
    const tel = (dados.telefone ?? '').replace(/\D/g, '');
    if (tel.length < 10 || tel.length > 11) return 'Informe o telefone com DDD.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((dados.email ?? '').trim())) return 'Informe um e-mail válido.';
    if (!dados.especialidades?.length) return 'Marque pelo menos uma especialidade.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.credenciadaAte ?? '')) return 'Informe até quando vale o credenciamento.';
    if (!ignorarId && dados.credenciadaAte < hojeISO()) return 'O credenciamento informado já venceu.';
    return null;
  }

  cadastrar(dados: DadosAssistencia): Resultado<AssistenciaTecnica> {
    const erro = this.validar(dados);
    if (erro) return falha(erro);
    const nova: AssistenciaTecnica = { ...this.limpar(dados), id: crypto.randomUUID(), ativa: true, criadaEm: agoraISO() };
    this.todas.update((l) => [...l, nova]);
    return sucesso(nova);
  }

  atualizar(id: string, dados: DadosAssistencia): string | null {
    if (!this.buscarPorId(id)) return 'Assistência não encontrada.';
    const erro = this.validar(dados, id);
    if (erro) return erro;
    this.todas.update((l) => l.map((a) => (a.id === id ? { ...a, ...this.limpar(dados), atualizadaEm: agoraISO() } : a)));
    return null;
  }

  /** Descredencia ou recredencia (nunca apaga: o histórico das manutenções aponta para ela). */
  alternarAtiva(id: string): void {
    this.todas.update((l) => l.map((a) => (a.id === id ? { ...a, ativa: !a.ativa, atualizadaEm: agoraISO() } : a)));
  }

  reiniciar(): void {
    this.todas.set(criarAssistenciasDemo());
  }

  private limpar(d: DadosAssistencia): DadosAssistencia {
    return {
      nomeFantasia: d.nomeFantasia.trim(),
      razaoSocial: d.razaoSocial.trim(),
      cnpj: d.cnpj.replace(/\D/g, ''),
      telefone: d.telefone.replace(/\D/g, ''),
      email: d.email.trim().toLowerCase(),
      endereco: d.endereco?.trim() || undefined,
      especialidades: [...new Set(d.especialidades)],
      credenciadaAte: d.credenciadaAte,
      contrato: d.contrato?.trim() || undefined,
    };
  }
}

/** Empresas FICTÍCIAS de exemplo (CNPJs gerados só com dígitos verificadores válidos). */
export function criarAssistenciasDemo(): AssistenciaTecnica[] {
  const hoje = hojeISO();
  const base = (o: Omit<AssistenciaTecnica, 'ativa' | 'criadaEm'>): AssistenciaTecnica => ({ ...o, ativa: true, criadaEm: somarDias(hoje, -200) });
  return [
    base({
      id: 'ast-tech', nomeFantasia: 'Tech Assistência', razaoSocial: 'Tech Assistência em Informática Ltda',
      cnpj: '09448224000135', telefone: '9632231010', email: 'atendimento@techassistencia.com.br',
      endereco: 'Av. FAB, 1200, Centro, Macapá-AP', especialidades: ['eletronico', 'outros'],
      credenciadaAte: somarDias(hoje, 240), contrato: 'Ata de credenciamento 004/2026',
    }),
    base({
      id: 'ast-ferramentas', nomeFantasia: 'Oficina Norte Ferramentas', razaoSocial: 'Norte Reparos de Ferramentas Ltda',
      cnpj: '63412702000100', telefone: '96991234567', email: 'contato@nortereparos.com.br',
      endereco: 'Rua Leopoldo Machado, 450, Trem, Macapá-AP', especialidades: ['ferramenta'],
      credenciadaAte: somarDias(hoje, 120), contrato: 'Ata de credenciamento 007/2026',
    }),
    base({
      id: 'ast-maker', nomeFantasia: 'Maker Norte Serviços', razaoSocial: 'Maker Norte Prototipagem e Serviços Ltda',
      cnpj: '30972007000136', telefone: '96981110022', email: 'suporte@makernorte.com.br',
      especialidades: ['impressora_3d', 'corte_laser'],
      credenciadaAte: somarDias(hoje, 90), contrato: 'Ata de credenciamento 009/2026',
    }),
    // Credenciamento vencido: aparece na lista, mas não pode receber equipamentos
    base({
      id: 'ast-antiga', nomeFantasia: 'Eletro Reparos AP', razaoSocial: 'Eletro Reparos do Amapá ME',
      cnpj: '89847080000129', telefone: '9632224455', email: 'eletroreparos@email.com',
      especialidades: ['eletronico'], credenciadaAte: somarDias(hoje, -15), contrato: 'Ata de credenciamento 002/2025',
    }),
  ];
}
