import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  montarPagina,
  type PaginacaoDto,
  type RespostaPaginada,
} from '../common/dto/index.js';
import { Perfil, StatusUsuario } from '../common/enums/index.js';
import { EquipamentosService } from '../equipamentos/equipamentos.service.js';
import {
  paraPublico,
  type UsuarioPublico,
  type UsuarioResumo,
} from './entities/usuario.entity.js';
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
  /** Padrão: `usuario`. Só o admin cria contas, então o perfil enviado é aceito. */
  perfil?: Perfil;
  /** Padrão: `ativo`. */
  status?: StatusUsuario;
  /** Ids de equipamentos que exigem treinamento. Padrão: nenhum. */
  habilitacoes?: string[];
}

/** Campos que podem ser alterados depois de criado (e-mail, CPF e senha têm métodos próprios). */
export interface AtualizacaoUsuario {
  habilitacoes?: string[];
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
    @Inject(EquipamentosService)
    private readonly equipamentos: EquipamentosService,
  ) {}

  /**
   * Cria o usuário. E-mail ou CPF já cadastrado: 409. Habilitação para equipamento que
   * não existe ou que não exige treinamento: 400.
   */
  async criar(dados: NovoUsuario): Promise<UsuarioPublico> {
    const email = normalizarEmail(dados.email);
    const cpf = normalizarCpf(dados.cpf);
    const habilitacoes = await this.conferirHabilitacoes(
      dados.habilitacoes ?? [],
    );
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
      habilitacoes,
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

  /**
   * Página do GET /usuarios: aplica os filtros, ordena pelo nome (A-Z) e recorta a página.
   */
  async listarPagina(
    filtro: FiltroUsuarios & Pick<PaginacaoDto, 'pagina' | 'itensPorPagina'>,
  ): Promise<RespostaPaginada<UsuarioPublico>> {
    const lista = await this.listar(filtro);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return montarPagina(lista, filtro);
  }

  /**
   * GET /usuarios/resumo: só os usuários ATIVOS, em ordem alfabética, com id, nome,
   * departamento e habilitações. `busca` procura no nome e no departamento.
   */
  async resumo(busca?: string): Promise<UsuarioResumo[]> {
    const alvo = busca?.trim().toLowerCase();
    const ativos = await this.listar({ status: StatusUsuario.Ativo });
    return ativos
      .filter(
        (u) =>
          !alvo ||
          u.nome.toLowerCase().includes(alvo) ||
          u.departamento?.toLowerCase().includes(alvo),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(({ id, nome, departamento, habilitacoes }) => ({
        id,
        nome,
        departamento,
        habilitacoes,
      }));
  }

  /**
   * Confere uma lista de habilitações e devolve sem repetidos. Cada id precisa ser de um
   * equipamento que existe E que exige treinamento; senão, 400 com o motivo.
   * Também usada pela troca de habilitações (card A4).
   */
  async conferirHabilitacoes(equipamentoIds: string[]): Promise<string[]> {
    const ids = [...new Set(equipamentoIds)];
    for (const id of ids) {
      const equipamento = await this.equipamentos.buscarPorId(id);
      if (!equipamento) {
        throw new BadRequestException(`O equipamento "${id}" não existe.`);
      }
      if (!equipamento.requerTreinamento) {
        throw new BadRequestException(
          `O equipamento "${equipamento.nome}" não exige treinamento: não precisa de habilitação.`,
        );
      }
    }
    return ids;
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
      habilitacoes: dados.habilitacoes
        ? [...new Set(dados.habilitacoes)]
        : undefined,
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
