import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
        <p>{{ canManageAttendance ? 'Gestiona las asistencias de tus alumnos' : 'Consulta tus asistencias registradas' }}</p>
      </div>

      <div class="filtros">
        <div class="filtro-group">
          <label for="materia">Materia</label>
          <select id="materia" [(ngModel)]="materiaSeleccionada" (ngModelChange)="onMateriaChange()" name="materia">
            <option [ngValue]="null">-- Selecciona una materia --</option>
            <option *ngFor="let m of materias" [ngValue]="m.id">{{m.nombre_materia}}</option>
          </select>
        </div>
        <div class="filtro-group">
          <label for="anio">Año</label>
          <input id="anio" type="number" [(ngModel)]="anioActual" min="2000" max="2100" (change)="cargarAsistencias()" />
        </div>
        <div class="filtro-group">
          <label for="mes">Mes</label>
          <input id="mes" type="number" [(ngModel)]="mesActual" min="1" max="12" (change)="cargarAsistencias()" />
        </div>
      </div>

      <div class="asistencia-form" *ngIf="canManageAttendance && materiaSeleccionada !== null">
        <h3>➕ Registrar asistencia</h3>
        <div class="form-group">
          <div class="field-group">
            <label for="alumno">Alumno</label>
            <select id="alumno" [(ngModel)]="usuarioSeleccionado" name="usuario">
              <option [ngValue]="null">-- Selecciona alumno --</option>
              <option *ngFor="let a of alumnos" [ngValue]="a.id">{{a.nombre}}</option>
            </select>
          </div>
          <div class="field-group">
            <label for="fecha">Fecha</label>
            <input id="fecha" type="date" [(ngModel)]="fechaSeleccionada" name="fecha" />
          </div>
          <div class="field-group">
            <label for="horasImpartidas">Horas impartidas</label>
            <input id="horasImpartidas" type="number" [(ngModel)]="horasImpartidas" min="1" name="horasImpartidas" />
          </div>
          <div class="field-group">
            <label for="horasAsistidas">Horas asistidas</label>
            <input id="horasAsistidas" type="number" [(ngModel)]="horasAsistidas" min="0" name="horasAsistidas" />
          </div>
          <div class="field-group">
            <label for="observacion">Observación</label>
            <input id="observacion" type="text" [(ngModel)]="observacion" name="observacion" />
          </div>
          <div class="field-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="presente" name="presente" />
              Presente
            </label>
          </div>
          <button class="btn-guardar" (click)="guardarAsistencia()" [disabled]="guardando || usuarioSeleccionado === null">
            {{ guardando ? 'Guardando...' : 'Guardar asistencia' }}
          </button>
        </div>
        <p *ngIf="alumnos.length === 0" class="empty-state">No hay alumnos registrados en el sistema.</p>
      </div>

      <div class="asistencias-lista" *ngIf="asistencias.length > 0">
        <div class="asistencia-item" *ngFor="let a of asistencias">
          <div class="asistencia-info">
            <strong>👤 {{a.usuarioNombre}}</strong>
            <span>📅 {{a.fecha | date:'dd/MM/yyyy'}}</span>
            <span class="badge" [class.presente]="a.presente" [class.ausente]="!a.presente">
              {{a.presente ? 'Presente' : 'Ausente'}}
            </span>
            <span>🕒 Horas asistidas: {{a.horasAsistidas}} / {{a.horasImpartidas}}</span>
            <p *ngIf="a.observacion" class="observacion">🗒️ {{a.observacion}}</p>
          </div>
          <button
            *ngIf="canManageAttendance"
            class="btn-eliminar"
            (click)="pedirConfirmacion(a.id, $event)">
            🗑️
          </button>
        </div>
      </div>

      <div class="empty-state" *ngIf="asistencias.length === 0 && materiaSeleccionada !== null">
        <p>📭 No hay asistencias registradas{{ canManageAttendance ? '' : ' a tu nombre' }} para esta materia.</p>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>

      <!-- Modal de confirmación -->
      <div class="modal-overlay" *ngIf="asistenciaAEliminar !== null" (click)="cancelarEliminacion()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-icon">🗑️</div>
          <h3>¿Eliminar asistencia?</h3>
          <p>Esta acción no se puede deshacer.</p>
          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cancelarEliminacion()">Cancelar</button>
            <button class="btn-confirmar" (click)="confirmarEliminacion()">Confirmar</button>
          </div>
        </div>
      </div>
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
  asistenciaAEliminar: number | null = null;

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.canManageAttendance = this.authService.canManageAttendance();

    this.asistenciaService.getMaterias().subscribe({
      next: data => this.materias = data,
      error: () => this.error = '❌ Error al cargar materias'
    });
  }

  onMateriaChange() {
    if (this.materiaSeleccionada === null) {
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
    if (this.materiaSeleccionada === null) return;

    this.asistenciaService.getAlumnosPorMateria(this.materiaSeleccionada).subscribe({
      next: data => { this.alumnos = data; this.cdr.detectChanges(); },
      error: () => { this.error = '❌ Error al cargar alumnos de la materia'; this.cdr.detectChanges(); }
    });
  }

  cargarAsistencias() {
    if (this.materiaSeleccionada === null) return;

    this.asistenciaService.getAsistencias(this.materiaSeleccionada, this.anioActual, this.mesActual).subscribe({
      next: data => { this.asistencias = data; this.cdr.detectChanges(); },
      error: () => { this.error = '❌ Error al cargar asistencias'; this.cdr.detectChanges(); }
    });
  }

  guardarAsistencia() {
    if (!this.canManageAttendance || this.materiaSeleccionada === null || this.usuarioSeleccionado === null) {
      this.error = '❌ Debes seleccionar materia y alumno para registrar asistencia.';
      return;
    }

    this.error = '';

    const alumno = this.alumnos.find(a => a.id === this.usuarioSeleccionado);
    const payload = {
      usuarioId: this.usuarioSeleccionado,
      materiaId: this.materiaSeleccionada,
      fecha: this.fechaSeleccionada,
      presente: this.presente,
      horasImpartidas: this.horasImpartidas,
      horasAsistidas: this.horasAsistidas,
      observacion: this.observacion.trim()
    };

    // Optimistic update: agregar al listado inmediatamente
    const optimista = {
      id: -1,
      usuarioId: this.usuarioSeleccionado!,
      materiaId: this.materiaSeleccionada!,
      fecha: this.fechaSeleccionada,
      presente: this.presente,
      horasImpartidas: this.horasImpartidas,
      horasAsistidas: this.horasAsistidas,
      observacion: this.observacion.trim(),
      usuarioNombre: alumno?.nombre ?? ''
    };
    this.asistencias = [optimista, ...this.asistencias];
    this.guardando = true;

    this.asistenciaService.guardarAsistencia(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.cargarAsistencias(); // reemplaza con datos reales del servidor
      },
      error: (err) => {
        this.guardando = false;
        this.asistencias = this.asistencias.filter(a => a.id !== -1); // revertir
        this.error = err?.status === 403
          ? '❌ Solo Maestro o Administrador pueden registrar asistencias.'
          : '❌ Error al guardar asistencia';
      }
    });
  }

  pedirConfirmacion(id: number, event: Event) {
    event.stopPropagation();
    this.asistenciaAEliminar = id;
  }

  cancelarEliminacion() {
    this.asistenciaAEliminar = null;
  }

  confirmarEliminacion() {
    if (this.asistenciaAEliminar === null) return;
    const id = this.asistenciaAEliminar;
    this.asistenciaAEliminar = null;

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