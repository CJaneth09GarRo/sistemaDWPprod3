import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  styleUrl: './registro.component.css',
  template: `
    <div class="registro-container">
      <div class="registro-card">
        <div class="card-header">
          <div class="sparkle-icon">✨</div>
          <h2>Crear Cuenta</h2>
          <p>Únete a nuestra comunidad educativa</p>
        </div>
        <form (ngSubmit)="onSubmit()">
          <div class="input-group">
            <label for="nombre">👤 Nombre Completo</label>
            <input id="nombre" type="text" [(ngModel)]="nombre"
                   name="nombre" required minlength="3">
          </div>
          <div class="input-group">
            <label for="correo">📧 Correo Electrónico</label>
            <input id="correo" type="email" [(ngModel)]="correo"
                   name="correo" required autocomplete="email">
          </div>
          <div class="input-group">
            <label for="edad">🎂 Edad</label>
            <input id="edad" type="number" [(ngModel)]="edad"
                   name="edad" required min="5" max="99">
          </div>
          <div class="input-group">
            <label for="contrasena">🔒 Contraseña</label>
            <input id="contrasena" type="password" [(ngModel)]="contrasena"
                   name="contrasena" required minlength="6"
                   autocomplete="new-password">
          </div>
          <div class="input-group">
            <label for="rol">👔 Rol</label>
            <select id="rol" [(ngModel)]="rol" name="rol">
              <option value="Alumno">👩‍🎓 Alumno</option>
              <option value="Maestro">👩‍🏫 Maestro</option>
              <option value="Secretario">📋 Secretario</option>
            </select>
          </div>
          <button type="submit" class="btn-registro" [disabled]="cargando">
            {{ cargando ? 'Registrando...' : 'Registrarse' }}
          </button>
          <p class="login-link">
            ¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a>
          </p>
        </form>
        <div *ngIf="mensaje" class="success-message">{{mensaje}}</div>
        <div *ngIf="error" class="error-message">{{error}}</div>
      </div>
    </div>
  `,
})
export class RegistroComponent {
  nombre = '';
  correo = '';
  edad: number | null = null;   // ✅ null en lugar de 0
  contrasena = '';
  rol = 'Alumno';
  mensaje = '';
  error = '';
  cargando = false;

  constructor(private authService: AuthService, private router: Router) { }

  onSubmit() {
    if (this.cargando) return;
    this.cargando = true;
    this.mensaje = '';
    this.error = '';

    this.authService.registro({
      nombre: this.nombre,
      correo: this.correo,
      edad: this.edad!,
      contrasena: this.contrasena,
      rol: this.rol
    }).subscribe({
      next: () => {
        this.mensaje = '✅ Registro exitoso. Redirigiendo al login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: () => {
        this.error = '❌ Error al registrar usuario';
        this.cargando = false;
      }
    });
  }
}