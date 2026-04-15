import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AsistenciaService } from '../../services/asistencia.service';
import { Materia, Usuario } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <div class="welcome-card">
        <div class="welcome-avatar">🌸</div>
        <h2>¡Hola, {{usuario?.nombre}}!</h2>
        <div class="user-info">
          <span class="badge-rol">{{usuario?.rol}}</span>
          <span>📧 {{usuario?.correo}}</span>
        </div>
      </div>

      <div class="stats-container">
        <div class="stat-card" *ngFor="let stat of estadisticas">
          <div class="stat-icon">{{stat.icon}}</div>
          <div class="stat-number">{{stat.valor}}</div>
          <div class="stat-label">{{stat.label}}</div>
        </div>
      </div>

      <div class="materias-section">
        <h3>📚 Mis Materias</h3>
        <div *ngIf="cargando" class="loading">Cargando materias...</div>
        <div class="materias-grid" *ngIf="!cargando">
          <div *ngFor="let materia of materias" class="materia-card">
            <div class="materia-icon">📖</div>
            <h4>{{materia.nombre_materia}}</h4>
            <p>⏰ {{materia.horas_planificadas}} horas planificadas</p>
            <div class="progreso">
              <div class="barra" [style.width.%]="materia.id"></div>
            </div>
            <span class="progreso-label">{{materia.horas_planificadas}}%</span>
          </div>
        </div>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  usuario: Usuario | null = null;
  materias: Materia[] = [];
  cargando = false;
  error = '';

  estadisticas = [
    { icon: '📊', valor: '—', label: 'Total Asistencias' },
    { icon: '✅', valor: '—', label: 'Asistencias Completas' },
    { icon: '📈', valor: '—', label: 'Porcentaje' },
    { icon: '⭐', valor: '—', label: 'Materias Cursadas' }
  ];

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) { }

  ngOnInit() {
    this.usuario = this.authService.getUser();
    this.cargarMaterias();
  }

  cargarMaterias() {
    this.cargando = true;
    this.asistenciaService.getMaterias().subscribe({
      next: data => {
        this.materias = data.map(m => ({
          ...m,
          progreso: Math.floor(Math.random() * 30) + 70
        }));
        // ✅ estadísticas basadas en datos reales
        this.estadisticas[3].valor = String(data.length);
        this.cargando = false;
      },
      error: () => {
        this.error = '❌ Error al cargar materias';
        this.cargando = false;
      }
    });
  }
}