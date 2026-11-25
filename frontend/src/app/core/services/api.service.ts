import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';

/** Transporte comum: devolve apenas dados; erros seguem para o interceptor e o assinante. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(caminho: string, filtros?: object): Observable<T> {
    return this.http.get<ApiResponse<T>>(this.url(caminho), { params: this.params(filtros) })
      .pipe(map((resposta) => resposta.dados));
  }
  post<T>(caminho: string, corpo: unknown, filtros?: object): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(caminho), corpo, { params: this.params(filtros) })
      .pipe(map((resposta) => resposta.dados));
  }
  patch<T>(caminho: string, corpo: unknown, filtros?: object): Observable<T> {
    return this.http.patch<ApiResponse<T>>(this.url(caminho), corpo, { params: this.params(filtros) })
      .pipe(map((resposta) => resposta.dados));
  }
  put<T>(caminho: string, corpo: unknown, filtros?: object): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.url(caminho), corpo, { params: this.params(filtros) })
      .pipe(map((resposta) => resposta.dados));
  }
  delete<T>(caminho: string, filtros?: object): Observable<T> {
    return this.http.delete<ApiResponse<T>>(this.url(caminho), { params: this.params(filtros) })
      .pipe(map((resposta) => resposta.dados));
  }

  private url(caminho: string): string {
    return `${API_URL.replace(/\/+$/, '')}/${caminho.replace(/^\/+/, '')}`;
  }
  private params(filtros?: object): HttpParams {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtros ?? {})) {
      for (const item of Array.isArray(valor) ? valor : [valor]) {
        if (item === null || item === undefined || (typeof item === 'string' && !item.trim())) continue;
        params = params.append(chave, String(item));
      }
    }
    return params;
  }
}
