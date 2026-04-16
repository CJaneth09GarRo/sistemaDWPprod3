import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  styleUrl: './login.component.css',
  template: `
    <div class="login-container">
      <div class="login-card" [class.animada]="cardAnimada"
           (mouseenter)="cardAnimada = true"
           (mouseleave)="cardAnimada = false">
        <div class="card-header">
          <div class="flower-icon">🌸</div>
          <h2>Bienvenida</h2>
          <p>Inicia sesión en tu cuenta</p>
        </div>
        <form (ngSubmit)="onSubmit()">
          <div class="input-group">
            <label for="correo">📧 Correo Electrónico</label>
            <input id="correo" type="email" [(ngModel)]="correo"
                   name="correo" required autocomplete="email">
          </div>
          <div class="input-group">
            <label for="contrasena">🔒 Contraseña</label>
            <input id="contrasena" type="password" [(ngModel)]="contrasena"
                   name="contrasena" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-login" [disabled]="cargando">
            {{ cargando ? 'Ingresando...' : 'Ingresar' }}
          </button>
          <p class="register-link">
            ¿No tienes cuenta? <a routerLink="/registro">Regístrate aquí</a>
          </p>
        </form>
        <div *ngIf="error" class="error-message">{{error}}</div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  correo = '';
  contrasena = '';
  error = '';
  cargando = false;         // ✅ estado de carga
  cardAnimada = false;

  constructor(private authService: AuthService, private router: Router) { }

  onSubmit() {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.authService.login(this.correo, this.contrasena).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        if (err.status === 503) {
          this.error = '❌ El servicio no está disponible. Intenta más tarde.';
        } else if (err.status === 0) {
          this.error = '❌ No se puede conectar con el servidor.';
        } else {
          this.error = '❌ Credenciales incorrectas';
        }
        this.cargando = false;
      }
    });
  }
}