import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'USER';
  status: 'Ativo' | 'Inativo';
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css'
})
export class AdminUsuarios {

  usuarios: Usuario[] = [
    {
      id: 1,
      nome: 'João Silva',
      email: 'joao@email.com',
      perfil: 'USER',
      status: 'Ativo'
    },
    {
      id: 2,
      nome: 'Maria Santos',
      email: 'maria@email.com',
      perfil: 'ADMIN',
      status: 'Ativo'
    },
    {
      id: 3,
      nome: 'Carlos Souza',
      email: 'carlos@email.com',
      perfil: 'USER',
      status: 'Inativo'
    }
  ];

  termoBusca = '';

  get usuariosFiltrados(): Usuario[] {
    const termo = this.termoBusca.toLowerCase().trim();

    if (!termo) {
      return this.usuarios;
    }

    return this.usuarios.filter(usuario =>
      usuario.nome.toLowerCase().includes(termo) ||
      usuario.email.toLowerCase().includes(termo)
    );
  }

  get totalUsuarios(): number {
    return this.usuarios.length;
  }

  get totalAdmins(): number {
    return this.usuarios.filter(
      usuario => usuario.perfil === 'ADMIN'
    ).length;
  }

  get totalUsers(): number {
    return this.usuarios.filter(
      usuario => usuario.perfil === 'USER'
    ).length;
  }

  alterarPerfil(usuario: Usuario): void {
    usuario.perfil =
      usuario.perfil === 'ADMIN' ? 'USER' : 'ADMIN';
  }
}