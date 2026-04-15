import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AsistenciaService } from '../../services/asistencia.service';
import { AlumnoMateria, Asistencia, Materia } from '../../models/models';

@Component({
  selector: 'app-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './asistencia.component.css',
  template: `
    <div class="asistencia-container">
      <div class="header-card">
        <h2>📋 Registro de Asistencias</h2>
        <p>Gestiona las asistencias de tus alumnos</p>
      </div>

      <div class="filtros">
        <select [(ngModel)]="materiaSeleccionada" (change)="onMateriaChange()" name="materia">
          <option [ngValue]="null">-- Selecciona una materia --</option>
          <option *ngFor="let m of materias" [ngValue]="m.id">{{m.nombre_materia}}</option>
        </select>
        <input type="number" [(ngModel)]="anioActual" min="2000" max="2100" (change)="cargarAsistencias()" />
        <input type="number" [(ngModel)]="mesActual" min="1" max="12" (change)="cargarAsistencias()" />
      </div>

      <div class="asistencia-form" *ngIf="canManageAttendance && materiaSeleccionada != null">
        <h3>➕ Registrar asistencia</h3>
        <div class="form-group">
          <select [(ngModel)]="usuarioSeleccionado" name="usuario">
            <option [ngValue]="null">-- Selecciona alumno --</option>
            <option *ngFor="let a of alumnos" [ngValue]="a.id">{{a.nombre}}</option>
          </select>
          <input type="date" [(ngModel)]="fechaSeleccionada" name="fecha" />
          <input type="number" [(ngModel)]="horasImpartidas" min="1" placeholder="Horas impartidas" name="horasImpartidas" />
          <input type="number" [(ngModel)]="horasAsistidas" min="0" placeholder="Horas asistidas" name="horasAsistidas" />
          <input type="text" [(ngModel)]="observacion" placeholder="Observación" name="observacion" />
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="presente" name="presente" />
            Presente
          </label>
          <button class="btn-guardar" (click)="guardarAsistencia()" [disabled]="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar asistencia' }}
          </button>
        </div>
        <p *ngIf="alumnos.length === 0" class="empty-state">No hay alumnos asociados a la materia seleccionada.</p>
      </div>

      <div class="asistencias-lista" *ngIf="asistencias.length > 0">
        <div class="asistencia-item" *ngFor="let a of asistencias">
          <div class="asistencia-info">
            <strong>👤 {{a.usuarioNombre}}</strong>
            <span>📅 {{a.fecha | date:'dd/MM/yyyy'}}</span>
            <span class="badge" [class.presente]="a.presente" [class.ausente]="!a.presente">
              {{a.presente ? 'Presente' : 'Ausente'}}
            </span>
            <span>🕒 {{a.horasAsistidas}} / {{a.horasImpartidas}} horas</span>
            <p *ngIf="a.observacion" class="observacion">🗒️ {{a.observacion}}</p>
          </div>
          <button
            *ngIf="canManageAttendance"
            class="btn-eliminar"
            (click)="eliminarAsistencia(a.id)">
            🗑️
          </button>
        </div>
      </div>

      <div class="empty-state" *ngIf="asistencias.length === 0 && materiaSeleccionada">
        <p>📭 No hay asistencias registradas para esta materia.</p>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>
    </div>
  `,
})
export class AsistenciaComponent implements OnInit {
  materias: Materia[] = [];
  asistencias: Asistencia[] = [];
  alumnos: AlumnoMateria[] = [];

  materiaSeleccionada: number | null = null;
  anioActual = new Date().getFullYear();
  mesActual = new Date().getMonth() + 1;

  canManageAttendance = false;
  usuarioSeleccionado: number | null = null;
  fechaSeleccionada = new Date().toISOString().slice(0, 10);
  presente = true;
  horasImpartidas = 1;
  horasAsistidas = 1;
  observacion = '';
  guardando = false;
  error = '';

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) { }

  ngOnInit() {
    this.canManageAttendance = this.authService.canManageAttendance();

    this.asistenciaService.getMaterias().subscribe({
      next: data => this.materias = data,
      error: () => this.error = '❌ Error al cargar materias'
    });
  }

  onMateriaChange() {
    if (this.materiaSeleccionada == null) {
      this.asistencias = [];
      this.alumnos = [];
      return;
    }

    this.cargarAsistencias();
    if (this.canManageAttendance) {
      this.cargarAlumnos();
    }
  }

  cargarAlumnos() {
    if (this.materiaSeleccionada == null) return;

    this.asistenciaService.getAlumnosPorMateria(this.materiaSeleccionada).subscribe({
      next: data => this.alumnos = data,
      error: () => this.error = '❌ Error al cargar alumnos de la materia'
    });
  }

  cargarAsistencias() {
    if (this.materiaSeleccionada == null) return;

    this.asistenciaService.getAsistencias(this.materiaSeleccionada, this.anioActual, this.mesActual).subscribe({
      next: data => this.asistencias = data,
      error: () => this.error = '❌ Error al cargar asistencias'
    });
  }

  guardarAsistencia() {
    if (!this.canManageAttendance || this.materiaSeleccionada == null || this.usuarioSeleccionado == null) {
      this.error = '❌ Debes seleccionar materia y alumno para registrar asistencia.';
      return;
    }

    this.guardando = true;
    this.error = '';

    const payload = {
      usuarioId: this.usuarioSeleccionado,
      materiaId: this.materiaSeleccionada,
      fecha: this.fechaSeleccionada,
      presente: this.presente,
      horasImpartidas: this.horasImpartidas,
      horasAsistidas: this.horasAsistidas,
      observacion: this.observacion.trim()
    };

    this.asistenciaService.guardarAsistencia(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.cargarAsistencias();
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.status === 403
          ? '❌ Solo Maestro o Administrador pueden registrar asistencias.'
          : '❌ Error al guardar asistencia';
      }
    });
  }

  eliminarAsistencia(id: number) {
    if (!this.canManageAttendance) {
      this.error = '❌ No tienes permisos para eliminar asistencias.';
      return;
    }

    this.asistenciaService.eliminarAsistencia(id).subscribe({
      next: () => this.cargarAsistencias(),
      error: (err) => {
        this.error = err?.status === 403
          ? '❌ Solo Maestro o Administrador pueden eliminar asistencias.'
          : '❌ Error al eliminar asistencia';
      }
    });
  }
}