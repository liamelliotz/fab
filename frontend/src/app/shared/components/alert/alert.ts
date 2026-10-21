
import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  readonly notificationService = inject(NotificationService);

  fechar(id: number): void {
    this.notificationService.fechar(id);
  }
}
