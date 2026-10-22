import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Perfil, StatusUsuario } from '../common/enums/index.js';
import { paraPublico, type UsuarioPublico } from './entities/usuario.entity.js';
import { UsuariosRepository } from './usuarios.repository.js';
import {
  conferirSenha,
  gerarHash,
  normalizarCpf,
  normalizarEmail,
} from './usuarios.util.js';

/** Dados para criar um usuário. A `senha` chega em texto e é guardada só como hash. */
export interface NovoUsuario {
  nome: string;
  email: string;
  cpf: string;
  senha: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  /** Padrão: `usuario`. Quem decide se aceita o perfil enviado é o controller (Card 5). */
  perfil?: Perfil;
  /** Padrão: `ativo`. */
  status?: StatusUsuario;
}

/** Campos que podem ser alterados depois de criado (e-mail, CPF e senha têm métodos próprios). */
export interface AtualizacaoUsuario {
  nome?: string;
  telefone?: string;
  matricula?: string;
  departamento?: string;
  perfil?: Perfil;
}

export interface FiltroUsuarios {
  /** Procura no nome, e-mail, matrícula e departamento. */
  busca?: string;
  perfil?: Perfil;
  status?: StatusUsuario;
}

/**
 * Regras de negócio dos usuários.
 *
 * Todo método devolve `UsuarioPublico` (sem `senhaHash`). O hash nunca sai deste service:
 * para conferir a senha use `validarCredenciais`, e para trocá-la use `alterarSenha`.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @Inject(UsuariosRepository)
    private readonly repositorio: UsuariosRepository,
  ) {}

  /** Cria o usuário. E-mail ou CPF já cadastrado: 409. */
  async criar(dados: NovoUsuario): Promise<UsuarioPublico> {
    const email = normalizarEmail(dados.email);
    const cpf = normalizarCpf(dados.cpf);
    // O hash é calculado antes das checagens para a gravação vir logo depois delas.
    const senhaHash = await gerarHash(dados.senha);

    if (await this.repositorio.buscarPorEmail(email)) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    if (await this.repositorio.buscarPorCpf(cpf)) {
      throw new ConflictException('Já existe um usuário com este CPF.');
    }

    const criado = await this.repositorio.criar({
      nome: dados.nome.trim(),
      email,
      senhaHash,
      cpf,
      telefone: dados.telefone?.trim(),
      matricula: dados.matricula?.trim(),
      departamento: dados.departamento?.trim(),
      perfil: dados.perfil ?? Perfil.Usuario,
      status: dados.status ?? StatusUsuario.Ativo,
      criadoEm: new Date().toISOString(),
    });
    return paraPublico(criado);
  }

  /** Devolve o usuário ou `null` se não existir. */
  async buscarPorId(id: string): Promise<UsuarioPublico | null> {
    const usuario = await this.repositorio.buscarPorId(id);
    return usuario ? paraPublico(usuario) : null;
  }

  /** Igual a `buscarPorId`, mas lança 404 se não existir (para usar nos controllers). */
  async obterPorId(id: string): Promise<UsuarioPublico> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return usuario;
  }

  /** Devolve o usuário ou `null`. Ignora maiúsculas e espaços nas pontas do e-mail. */
  async buscarPorEmail(email: string): Promise<UsuarioPublico | null> {
    const usuario = await this.repositorio.buscarPorEmail(email);
    return usuario ? paraPublico(usuario) : null;
  }

  /**
   * Todos os usuários que atendem ao filtro, na ordem de criação.
   * A paginação fica para quem expõe a rota (use `montarPagina` do common/dto).
   */
  async listar(filtro: FiltroUsuarios = {}): Promise<UsuarioPublico[]> {
    const busca = filtro.busca?.trim().toLowerCase();
    const todos = await this.repositorio.listar();

    return todos
      .filter((usuario) => !filtro.perfil || usuario.perfil === filtro.perfil)
      .filter((usuario) => !filtro.status || usuario.status === filtro.status)
      .filter(
        (usuario) =>
          !busca ||
          [
            usuario.nome,
            usuario.email,
            usuario.matricula,
            usuario.departamento,
          ].some((campo) => campo?.toLowerCase().includes(busca)),
      )
      .map(paraPublico);
  }

  /** Altera só os campos informados. Usuário inexistente: 404. */
  async atualizar(
    id: string,
    dados: AtualizacaoUsuario,
  ): Promise<UsuarioPublico> {
    const atualizado = await this.repositorio.atualizar(id, {
      nome: dados.nome?.trim(),
      telefone: dados.telefone?.trim(),
      matricula: dados.matricula?.trim(),
      departamento: dados.departamento?.trim(),
      perfil: dados.perfil,
      atualizadoEm: new Date().toISOString(),
    });
    if (!atualizado) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return paraPublico(atualizado);
  }

  /** Muda o status da conta (ativo, inativo ou bloqueado). Usuário inexistente: 404. */
  async alterarStatus(
    id: string,
    status: StatusUsuario,
  ): Promise<UsuarioPublico> {
    const atualizado = await this.repositorio.atualizar(id, {
      status,
      atualizadoEm: new Date().toISOString(),
    });
    if (!atualizado) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return paraPublico(atualizado);
  }

  /** Troca a senha (guarda só o novo hash). Usada pela redefinição de senha (Card 8). */
  async alterarSenha(id: string, novaSenha: string): Promise<void> {
    const atualizado = await this.repositorio.atualizar(id, {
      senhaHash: await gerarHash(novaSenha),
      atualizadoEm: new Date().toISOString(),
    });
    if (!atualizado) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }

  /**
   * Confere e-mail e senha. Devolve o usuário se estiverem certos e `null` se o e-mail
   * não existir OU a senha estiver errada (o motivo não é revelado de propósito).
   *
   * Não olha o `status`: quem faz o login (Card 5) decide o que fazer com conta inativa.
   */
  async validarCredenciais(
    email: string,
    senha: string,
  ): Promise<UsuarioPublico | null> {
    const usuario = await this.repositorio.buscarPorEmail(email);
    const confere = await conferirSenha(senha, usuario?.senhaHash);
    return usuario && confere ? paraPublico(usuario) : null;
  }
}
