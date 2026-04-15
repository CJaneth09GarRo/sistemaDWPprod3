import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AsistenciaService } from '../../services/asistencia.service';

@Component({
  selector: 'app-asistencia',          // ✅ corregido (era app-dashboard)
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="asistencia-container">
      <div class="header-card">
        <h2>📋 Registro de Asistencias</h2>
        <p>Gestiona las asistencias de tus alumnos</p>
      </div>

      <div class="filtros">
        <select [(ngModel)]="materiaSeleccionada" (change)="cargarAsistencias()" name="materia">
          <option value="">-- Selecciona una materia --</option>
          <option *ngFor="let m of materias" [value]="m.id">{{m.nombre_materia}}</option>
        </select>
      </div>

      <div class="tabla-container" *ngIf="asistencias.length > 0">
        <table>
          <thead>
            <tr>
              <th>👤 Alumno</th>
              <th>📅 Fecha</th>
              <th>✅ Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of asistencias">
              <td>{{a.nombre_alumno}}</td>
              <td>{{a.fecha | date:'dd/MM/yyyy'}}</td>
              <td>
                <span [class]="a.presente ? 'badge-presente' : 'badge-ausente'">
                  {{a.presente ? 'Presente' : 'Ausente'}}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-state" *ngIf="asistencias.length === 0 && materiaSeleccionada">
        <p>📭 No hay asistencias registradas para esta materia.</p>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>
    </div>
  `,
})
export class AsistenciaComponent implements OnInit {  // ✅ clase correcta
  materias: any[] = [];
  asistencias: any[] = [];
  materiaSeleccionada = '';
  error = '';

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) {}

  ngOnInit() {
    this.asistenciaService.getMaterias().subscribe({
      next: data => this.materias = data,
      error: () => this.error = '❌ Error al cargar materias'
    });
  }

  cargarAsistencias() {
    if (!this.materiaSeleccionada) return;
    this.asistenciaService.getAsistencias(this.materiaSeleccionada).subscribe({
      next: data => this.asistencias = data,
      error: () => this.error = '❌ Error al cargar asistencias'
    });
  }
}