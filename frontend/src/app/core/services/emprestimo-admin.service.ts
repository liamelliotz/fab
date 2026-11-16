import { Injectable, Injector, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, defer, of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { EmprestimoService } from './emprestimo.service';
import { EquipamentoService } from './equipamento.service';
import { ENDPOINTS } from '../constants/api.constants';
import { AvaliarEmprestimoDTO, Emprestimo, FiltroEmprestimoDTO } from '../models/emprestimo.model';
import { RespostaPaginada } from '../models/pagination.model';
import { normalizarCodigo } from '../utils/codigo.utils';

export interface FiltroEmprestimoAdmin extends FiltroEmprestimoDTO { pagina?: number; itensPorPagina?: number; }
export interface ConsultaBalcao { tipo: 'retirada' | 'devolucao'; emprestimo: Emprestimo; }
export interface DevolucaoBalcaoDTO { codigo: string; houveAvaria: boolean; observacoes?: string; }

export function mensagemErroAdmin(erro: unknown): string {
  const resposta = erro as HttpErrorResponse;
  const mensagem = resposta?.error?.mensagem;
  return typeof mensagem === 'string' && mensagem ? mensagem : 'Não foi possível concluir a operação. Tente novamente.';
}

/** Transporte do admin separado do serviço usado pelo card C8. Não faz fallback silencioso para mocks. */
@Injectable({ providedIn: 'root' })
export class EmprestimoAdminService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  readonly modoDemo = inject(AuthService).modoDemo;
  private get demo(): EmprestimoService { return this.injector.get(EmprestimoService); }

  listar(filtros: FiltroEmprestimoAdmin = {}): Observable<RespostaPaginada<Emprestimo>> {
    if (!this.modoDemo) return this.api.get(ENDPOINTS.emprestimos.base, filtros);
    return defer(() => {
      const pagina = Math.max(1, filtros.pagina ?? 1);
      const tamanho = Math.min(100, Math.max(1, filtros.itensPorPagina ?? 10));
      const itens = this.demo.todas().map((s) => this.prepararDemo(s)).filter((s) =>
        (!filtros.status || s.status === filtros.status) &&
        (!filtros.solicitanteId || s.solicitante.id === filtros.solicitanteId) &&
        (!filtros.dataInicio || s.dataSolicitacao.slice(0, 10) >= filtros.dataInicio) &&
        (!filtros.dataFim || s.dataSolicitacao.slice(0, 10) <= filtros.dataFim) &&
        (!filtros.atrasadosApenas || s.status === 'atrasado'));
      const totalPaginas = Math.ceil(itens.length / tamanho);
      return of({ itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho), totalItens: itens.length,
        paginaAtual: pagina, totalPaginas, itensPorPagina: tamanho,
        temProxima: pagina < totalPaginas, temAnterior: pagina > 1 });
    });
  }

  avaliar(id: string, dto: AvaliarEmprestimoDTO): Observable<Emprestimo> {
    if (!this.modoDemo) return this.api.patch(ENDPOINTS.emprestimos.avaliar(id), dto);
    return defer(() => {
      const erro = this.demo.avaliar(id, dto.aprovado, dto.motivo ?? '');
      if (erro) throw this.erro(409, erro);
      return of(this.prepararDemo(this.demo.buscarPorId(id)!));
    });
  }

  consultarCodigo(texto: string): Observable<ConsultaBalcao> {
    const codigo = normalizarCodigo(texto);
    if (!this.modoDemo) return this.api.get(ENDPOINTS.emprestimos.balcao.consulta, { codigo });
    return defer(() => {
      const retirada = this.demo.buscarPorCodigoRetirada(codigo);
      const devolucao = this.demo.buscarPorCodigoDevolucao(codigo);
      if (!retirada && !devolucao) throw this.erro(404, this.demo.erroCodigo(codigo, 'retirada'));
      return of({ tipo: retirada ? 'retirada' as const : 'devolucao' as const,
        emprestimo: this.prepararDemo((retirada ?? devolucao)!) });
    });
  }

  retirar(texto: string): Observable<Emprestimo> {
    const codigo = normalizarCodigo(texto);
    if (!this.modoDemo) return this.api.post(ENDPOINTS.emprestimos.balcao.retirada, { codigo });
    return defer(() => {
      const resultado = this.demo.confirmarRetirada(codigo);
      if (!resultado.ok) throw this.erro(409, resultado.erro);
      return of(this.prepararDemo(resultado.valor));
    });
  }

  devolver(dto: DevolucaoBalcaoDTO): Observable<Emprestimo> {
    const corpo = { codigo: normalizarCodigo(dto.codigo), houveAvaria: dto.houveAvaria,
      ...(dto.observacoes?.trim() ? { observacoes: dto.observacoes.trim() } : {}) };
    return defer(() => {
      if (corpo.houveAvaria && !corpo.observacoes) throw this.erro(400, 'Informe as observações da avaria.');
      if (!this.modoDemo) return this.api.post<Emprestimo>(ENDPOINTS.emprestimos.balcao.devolucao, corpo);
      const resultado = this.demo.confirmarDevolucao(corpo.codigo, { houveAvaria: corpo.houveAvaria, observacoes: corpo.observacoes ?? '' });
      if (!resultado.ok) throw this.erro(409, resultado.erro);
      return of(this.prepararDemo(resultado.valor));
    });
  }

  resumoItens(s: Emprestimo): string {
    return s.itens.map((item) => `${item.equipamento?.nome ?? item.equipamentoId} × ${item.quantidade}`).join(', ');
  }
  private prepararDemo(s: Emprestimo): Emprestimo {
    return { ...s, status: this.demo.estaAtrasado(s) ? 'atrasado' : s.status,
      itens: s.itens.map((i) => ({ ...i, equipamento: i.equipamento ?? this.injector.get(EquipamentoService).buscarPorId(i.equipamentoId) })) };
  }
  private erro(status: number, mensagem: string): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: { sucesso: false, mensagem, erros: [] } });
  }
}
