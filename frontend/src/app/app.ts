
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Alert } from './shared/components/alert/alert';
import { RestaurarDados } from './shared/components/restaurar-dados/restaurar-dados';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Alert, RestaurarDados],
  templateUrl: './app.html',
})
export class App {}
