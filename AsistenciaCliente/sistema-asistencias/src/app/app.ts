import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule],
  styleUrl: './app.css',
  template: `
    <!-- Menú de navegación solo visible para usuarios autenticados -->
    <nav class="navbar" *ngIf="authService.isLoggedIn()">
      <div class="nav-container">
        <div class="logo" (mouseenter)="animarLogo()" >
          <span class="logo-text" [class.animado]="logoAnimado">✨ SisAsistencias</span>
        </div>
        <ul class="nav-menu">
          <li><a routerLink="/" routerLinkActive="active" 
                 (mouseenter)="animarEnlace($event)" 
                 (mouseleave)="resetEnlace($event)">
            🏠 Inicio
          </a></li>
          <li><a routerLink="/dashboard" routerLinkActive="active"
                 (mouseenter)="animarEnlace($event)"
                 (mouseleave)="resetEnlace($event)">
            📊 Dashboard
          </a></li>
          <li><a routerLink="/asistencia" routerLinkActive="active"
                 (mouseenter)="animarEnlace($event)"
                 (mouseleave)="resetEnlace($event)">
            📝 Asistencias
          </a></li>
          <li><button class="logout-btn" (click)="logout()" 
                      (mouseenter)="animarBoton($event)"
                      (mouseleave)="resetBoton($event)">
            🚪 Cerrar Sesión
          </button></li>
        </ul>
      </div>
    </nav>
    <router-outlet></router-outlet>
  `,

})
export class App {
  logoAnimado = false;

  constructor(public authService: AuthService) { }

  animarLogo() {
    this.logoAnimado = true;
    setTimeout(() => this.logoAnimado = false, 300);
  }

  animarEnlace(event: MouseEvent) {
    const elemento = event.target as HTMLElement;
    elemento.style.transform = 'translateY(-3px) scale(1.05)';
  }

  resetEnlace(event: MouseEvent) {
    const elemento = event.target as HTMLElement;
    elemento.style.transform = 'translateY(0) scale(1)';
  }

  animarBoton(event: MouseEvent) {
    const elemento = event.target as HTMLElement;
    elemento.style.transform = 'scale(1.1) rotate(2deg)';
  }

  resetBoton(event: MouseEvent) {
    const elemento = event.target as HTMLElement;
    elemento.style.transform = 'scale(1) rotate(0deg)';
  }

  logout() {
    this.authService.logout();
    window.location.href = '/';
  }
}