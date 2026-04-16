import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-portada',
  standalone: true,
  imports: [RouterModule, CommonModule],
  styleUrl: './portada.component.css',
  template: `
    <div class="portada">
      <!-- Hero Section -->
      <div class="hero">
        <div class="school-icon" (mouseenter)="animarIcono()" (mouseleave)="resetIcono()" [class.animado]="iconoAnimado">
          🎓
        </div>
        <h1>Instituto Tecnológico de Estudios Superiores</h1>
        <h2>Sistema de Gestión de Asistencias</h2>
        <p class="description">
          Plataforma moderna y eficiente para el registro y control de asistencia de alumnos,
          optimizando la gestión académica con tecnología de vanguardia.
        </p>
        <div class="buttons">
          <a routerLink="/login" class="btn-primary" 
             (mouseenter)="animarBoton($event)" 
             (mouseleave)="resetBoton($event)">
            Iniciar Sesión
          </a>
          <a routerLink="/registro" class="btn-secondary"
             (mouseenter)="animarBoton($event)"
             (mouseleave)="resetBoton($event)">
            Registrarse
          </a>
        </div>
      </div>

      <!-- Features -->
      <div class="features">
        <div class="feature-card" *ngFor="let feature of features; let i = index"
             (mouseenter)="animarCard($event)" (mouseleave)="resetCard($event)">
          <div class="icon">{{feature.icon}}</div>
          <h3>{{feature.title}}</h3>
          <p>{{feature.description}}</p>
        </div>
      </div>

      <!-- Footer -->
      <footer class="footer">
        <p>© 2026 - Sistema de Asistencias Académicas | Versión 2.0</p>
        <p>Desarrollado  para la comunidad educativa</p>
      </footer>
    </div>
  `,
})
export class PortadaComponent {
  iconoAnimado = false;
  features = [
    { icon: '📊', title: 'Control Eficiente', description: 'Registra y monitorea asistencias en tiempo real' },
    { icon: '🔒', title: 'Seguridad Garantizada', description: 'Autenticación segura con JWT' },
    { icon: '📈', title: 'Reportes Detallados', description: 'Genera informes de asistencia por período' },
    { icon: '👩‍🏫', title: 'Gestión Docente', description: 'Administra materias y horarios fácilmente' },
    { icon: '🎓', title: 'Perfil Estudiantil', description: 'Visualiza tu progreso académico' },
    { icon: '💬', title: 'Comunicación', description: 'Mantente conectado con tus profesores' }
  ];

  animarIcono() {
    this.iconoAnimado = true;
    setTimeout(() => this.iconoAnimado = false, 300);
  }

  resetIcono() {
    this.iconoAnimado = false;
  }

  animarBoton(event: MouseEvent) {
    const btn = event.target as HTMLElement;
    btn.style.transform = 'translateY(-5px) scale(1.05)';
  }

  resetBoton(event: MouseEvent) {
    const btn = event.target as HTMLElement;
    btn.style.transform = 'translateY(0) scale(1)';
  }

  animarCard(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    card.style.transform = 'translateY(-10px) scale(1.05)';
  }

  resetCard(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    card.style.transform = 'translateY(0) scale(1)';
  }
}