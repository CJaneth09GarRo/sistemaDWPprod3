import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AsistenciaService } from '../../services/asistencia.service';
import { MateriaDetalle, Profesor, Usuario } from '../../models/models';

@Component({
  selector: 'app-materias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './materias.component.css',
  template: `
    <div class="materias-container">
      <div class="header-card">
        <div class="header-top">
          <div>
            <h2>📚 Materias</h2>
            <p>Listado de materias registradas en el sistema</p>
          </div>
          <button *ngIf="isAdmin" class="btn-nueva" (click)="abrirModalNueva()">
            ➕ Nueva Materia
          </button>
        </div>
      </div>

      <div *ngIf="cargando" class="loading">Cargando materias...</div>

      <div class="materias-grid" *ngIf="!cargando">
        <div *ngFor="let m of materias" class="materia-card">
          <div class="materia-icon">📖</div>
          <h3>{{m.nombre_materia}}</h3>
          <div class="materia-datos">
            <span>⏰ {{m.horas_planificadas}} horas planificadas</span>
            <span>👨‍🏫 {{m.profesorNombre ?? 'Sin profesor asignado'}}</span>
          </div>
          <div *ngIf="isAdmin" class="card-actions">
            <button class="btn-alumnos" (click)="abrirModalAlumnos(m, $event)">👥 Alumnos</button>
            <button class="btn-editar" (click)="abrirModalEditar(m, $event)">✏️ Editar</button>
            <button class="btn-eliminar" (click)="pedirConfirmacion(m.id, $event)">🗑️</button>
          </div>
        </div>
        <div *ngIf="materias.length === 0" class="empty-state">
          <p>📭 No hay materias registradas.</p>
        </div>
      </div>

      <div *ngIf="error" class="error-message">{{error}}</div>

      <!-- Modal nueva / editar materia -->
      <div class="modal-overlay" *ngIf="modalAbierto" (click)="cerrarModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>{{ editandoId ? '✏️ Editar Materia' : '➕ Nueva Materia' }}</h3>

          <div class="field-group">
            <label for="nombreMateria">Nombre de la materia</label>
            <input id="nombreMateria" type="text" [(ngModel)]="form.nombre" placeholder="Ej. Programación Web" />
          </div>
          <div class="field-group">
            <label for="horasMateria">Horas planificadas</label>
            <input id="horasMateria" type="number" [(ngModel)]="form.horas" min="1" />
          </div>
          <div class="field-group">
            <label for="profesor">Profesor asignado</label>
            <div class="profesor-row">
              <select id="profesor" [(ngModel)]="form.profesorId">
                <option [ngValue]="null">-- Sin profesor --</option>
                <option *ngFor="let p of profesores" [ngValue]="p.id">{{p.nombre}}</option>
              </select>
              <button class="btn-nuevo-prof" (click)="abrirModalProfesor()">+ Nuevo profesor</button>
            </div>
          </div>

          <div *ngIf="errorModal" class="error-message">{{errorModal}}</div>

          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cerrarModal()">Cancelar</button>
            <button class="btn-confirmar" (click)="guardarMateria()" [disabled]="guardando">
              {{ guardando ? 'Guardando...' : (editandoId ? 'Actualizar' : 'Guardar') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal gestión de alumnos inscritos -->
      <div class="modal-overlay" *ngIf="modalAlumnosAbierto" (click)="cerrarModalAlumnos()">
        <div class="modal-card modal-alumnos" (click)="$event.stopPropagation()">
          <h3>👥 Alumnos — {{materiaGestionando?.nombre_materia}}</h3>

          <!-- Agregar alumno -->
          <div class="agregar-alumno-row" *ngIf="alumnosDisponibles.length > 0">
            <select [(ngModel)]="alumnoParaInscribir">
              <option [ngValue]="null">-- Selecciona alumno para agregar --</option>
              <option *ngFor="let a of alumnosDisponibles" [ngValue]="a.id">{{a.nombre}}</option>
            </select>
            <button class="btn-inscribir" (click)="inscribir()" [disabled]="alumnoParaInscribir === null">+ Agregar</button>
          </div>
          <p *ngIf="alumnosDisponibles.length === 0 && alumnosInscritos.length > 0" class="todos-inscritos">
            ✅ Todos los alumnos ya están inscritos en esta materia.
          </p>
          <p *ngIf="alumnosDisponibles.length === 0 && alumnosInscritos.length === 0" class="todos-inscritos">
            No hay alumnos registrados en el sistema.
          </p>

          <!-- Lista inscritos -->
          <div class="inscritos-lista" *ngIf="alumnosInscritos.length > 0">
            <div class="inscrito-item" *ngFor="let a of alumnosInscritos">
              <span>{{a.nombre}}</span>
              <button class="btn-desinscribir" (click)="desinscribir(a)">✕</button>
            </div>
          </div>
          <p *ngIf="alumnosInscritos.length === 0" class="empty-state-sm">Sin alumnos inscritos aún.</p>

          <div *ngIf="errorAlumnos" class="error-message">{{errorAlumnos}}</div>

          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cerrarModalAlumnos()">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Modal nuevo profesor -->
      <div class="modal-overlay" *ngIf="modalProfesorAbierto" (click)="cerrarModalProfesor()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>👨‍🏫 Nuevo Profesor</h3>

          <div class="field-group">
            <label>Nombre completo</label>
            <input type="text" [(ngModel)]="nuevoProfesor.nombre" placeholder="Nombre" />
          </div>
          <div class="field-group">
            <label>Correo electrónico</label>
            <input type="email" [(ngModel)]="nuevoProfesor.correo" placeholder="correo@ejemplo.com" />
          </div>
          <div class="field-group">
            <label>Edad</label>
            <input type="number" [(ngModel)]="nuevoProfesor.edad" min="18" />
          </div>
          <div class="field-group">
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="nuevoProfesor.contrasena" placeholder="Mínimo 6 caracteres" />
          </div>

          <div *ngIf="errorProfesor" class="error-message">{{errorProfesor}}</div>

          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cerrarModalProfesor()">Cancelar</button>
            <button class="btn-confirmar" (click)="guardarProfesor()" [disabled]="guardandoProfesor">
              {{ guardandoProfesor ? 'Guardando...' : 'Crear profesor' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal confirmación eliminar -->
      <div class="modal-overlay" *ngIf="materiaAEliminar !== null" (click)="cancelarEliminacion()">
        <div class="modal-card modal-confirm" (click)="$event.stopPropagation()">
          <div class="modal-icon">🗑️</div>
          <h3>¿Eliminar materia?</h3>
          <p>Se eliminarán también las asistencias e inscripciones asociadas. Esta acción no se puede deshacer.</p>
          <div class="modal-actions">
            <button class="btn-cancelar" (click)="cancelarEliminacion()">Cancelar</button>
            <button class="btn-confirmar" (click)="confirmarEliminacion()">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class MateriasComponent implements OnInit {
  materias: MateriaDetalle[] = [];
  profesores: Profesor[] = [];
  cargando = false;
  error = '';
  isAdmin = false;

  modalAbierto = false;
  editandoId: number | null = null;
  guardando = false;
  errorModal = '';
  form = { nombre: '', horas: 48, profesorId: null as number | null };

  modalProfesorAbierto = false;
  guardandoProfesor = false;
  errorProfesor = '';
  nuevoProfesor = { nombre: '', correo: '', edad: 25, contrasena: '' };

  materiaAEliminar: number | null = null;

  // Gestión de inscripciones
  modalAlumnosAbierto = false;
  materiaGestionando: MateriaDetalle | null = null;
  alumnosInscritos: Usuario[] = [];
  alumnosDisponibles: Usuario[] = [];
  alumnoParaInscribir: number | null = null;
  errorAlumnos = '';

  constructor(
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) {}

  ngOnInit() {
    this.isAdmin = this.authService.isAdmin();
    this.cargarMaterias();
    this.cargarProfesores();
  }

  cargarMaterias() {
    this.cargando = true;
    this.asistenciaService.getMaterias().subscribe({
      next: data => { this.materias = data; this.cargando = false; },
      error: () => { this.error = '❌ Error al cargar materias'; this.cargando = false; }
    });
  }

  cargarProfesores() {
    this.asistenciaService.getProfesores().subscribe({
      next: data => this.profesores = data,
      error: () => {}
    });
  }

  // ── Modal nueva / editar materia ──

  abrirModalNueva() {
    this.editandoId = null;
    this.form = { nombre: '', horas: 48, profesorId: null };
    this.errorModal = '';
    this.modalAbierto = true;
  }

  abrirModalEditar(m: MateriaDetalle, event: Event) {
    event.stopPropagation();
    this.editandoId = m.id;
    this.form = { nombre: m.nombre_materia, horas: m.horas_planificadas, profesorId: m.profesorId };
    this.errorModal = '';
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  guardarMateria() {
    if (!this.form.nombre.trim()) {
      this.errorModal = '❌ El nombre de la materia es obligatorio.';
      return;
    }
    if (this.form.horas < 1) {
      this.errorModal = '❌ Las horas deben ser al menos 1.';
      return;
    }

    this.guardando = true;
    this.errorModal = '';

    const payload = {
      nombreMateria: this.form.nombre.trim(),
      horasPlanificadas: this.form.horas,
      profesorId: this.form.profesorId
    };

    const profesorNombre = this.profesores.find(p => p.id === this.form.profesorId)?.nombre ?? null;

    if (this.editandoId !== null) {
      const id = this.editandoId;
      this.materias = this.materias.map(m => m.id === id
        ? { ...m, nombre_materia: payload.nombreMateria, horas_planificadas: payload.horasPlanificadas, profesorId: payload.profesorId, profesorNombre }
        : m);
      this.cerrarModal();

      this.asistenciaService.editarMateria(id, payload).subscribe({
        next: () => { this.guardando = false; this.cargarMaterias(); },
        error: (err) => {
          this.guardando = false;
          this.cargarMaterias();
          this.error = err?.error?.mensaje ?? '❌ Error al actualizar la materia.';
        }
      });
    } else {
      const temporal: MateriaDetalle = {
        id: -1,
        nombre_materia: payload.nombreMateria,
        horas_planificadas: payload.horasPlanificadas,
        profesorId: payload.profesorId,
        profesorNombre
      };
      this.materias = [temporal, ...this.materias];
      this.cerrarModal();

      this.asistenciaService.crearMateria(payload).subscribe({
        next: () => { this.guardando = false; this.cargarMaterias(); },
        error: (err) => {
          this.guardando = false;
          this.materias = this.materias.filter(m => m.id !== -1);
          this.error = err?.error?.mensaje ?? '❌ Error al guardar la materia.';
        }
      });
    }
  }

  // ── Modal gestión de alumnos ──

  abrirModalAlumnos(m: MateriaDetalle, event: Event) {
    event.stopPropagation();
    this.materiaGestionando = m;
    this.alumnoParaInscribir = null;
    this.errorAlumnos = '';
    this.alumnosInscritos = [];
    this.alumnosDisponibles = [];
    this.modalAlumnosAbierto = true;
    this.cargarAlumnosMateria(m.id);
  }

  cerrarModalAlumnos() {
    this.modalAlumnosAbierto = false;
    this.materiaGestionando = null;
  }

  cargarAlumnosMateria(materiaId: number) {
    this.asistenciaService.getAlumnosPorMateria(materiaId).subscribe({
      next: (inscritos: any[]) => {
        this.alumnosInscritos = inscritos;
        this.asistenciaService.getAlumnosDisponibles(materiaId).subscribe({
          next: disponibles => this.alumnosDisponibles = disponibles,
          error: () => {}
        });
      },
      error: () => { this.errorAlumnos = '❌ Error al cargar alumnos'; }
    });
  }

  inscribir() {
    if (this.alumnoParaInscribir === null || !this.materiaGestionando) return;
    const alumnoId = this.alumnoParaInscribir;
    const materiaId = this.materiaGestionando.id;

    const alumno = this.alumnosDisponibles.find(a => a.id === alumnoId)!;
    // Optimistic
    this.alumnosInscritos = [...this.alumnosInscritos, alumno];
    this.alumnosDisponibles = this.alumnosDisponibles.filter(a => a.id !== alumnoId);
    this.alumnoParaInscribir = null;

    this.asistenciaService.inscribirAlumno(alumnoId, materiaId).subscribe({
      next: () => {},
      error: () => {
        this.cargarAlumnosMateria(materiaId);
        this.errorAlumnos = '❌ Error al inscribir alumno.';
      }
    });
  }

  desinscribir(alumno: Usuario) {
    if (!this.materiaGestionando) return;
    const materiaId = this.materiaGestionando.id;

    // Optimistic
    this.alumnosInscritos = this.alumnosInscritos.filter(a => a.id !== alumno.id);
    this.alumnosDisponibles = [...this.alumnosDisponibles, alumno].sort((a, b) => a.nombre.localeCompare(b.nombre));

    this.asistenciaService.desinscribirAlumno(alumno.id, materiaId).subscribe({
      next: () => {},
      error: () => {
        this.cargarAlumnosMateria(materiaId);
        this.errorAlumnos = '❌ Error al desinscribir alumno.';
      }
    });
  }

  // ── Eliminar materia ──

  pedirConfirmacion(id: number, event: Event) {
    event.stopPropagation();
    this.materiaAEliminar = id;
  }

  cancelarEliminacion() {
    this.materiaAEliminar = null;
  }

  confirmarEliminacion() {
    if (this.materiaAEliminar === null) return;
    const id = this.materiaAEliminar;
    this.materiaAEliminar = null;

    const backup = [...this.materias];
    this.materias = this.materias.filter(m => m.id !== id);

    this.asistenciaService.eliminarMateria(id).subscribe({
      next: () => {},
      error: (err) => {
        this.materias = backup;
        this.error = err?.error?.mensaje ?? '❌ Error al eliminar la materia.';
      }
    });
  }

  // ── Nuevo profesor ──

  abrirModalProfesor() {
    this.nuevoProfesor = { nombre: '', correo: '', edad: 25, contrasena: '' };
    this.errorProfesor = '';
    this.modalProfesorAbierto = true;
  }

  cerrarModalProfesor() {
    this.modalProfesorAbierto = false;
  }

  guardarProfesor() {
    if (!this.nuevoProfesor.nombre.trim() || !this.nuevoProfesor.correo.trim() || !this.nuevoProfesor.contrasena) {
      this.errorProfesor = '❌ Nombre, correo y contraseña son obligatorios.';
      return;
    }

    const nombre = this.nuevoProfesor.nombre.trim();
    const correo = this.nuevoProfesor.correo.trim();
    const edad = this.nuevoProfesor.edad;

    // Optimista: agregar con id temporal, seleccionarlo y cerrar el modal de inmediato
    const tempId = -Date.now();
    const temp: Profesor = { id: tempId, nombre, correo, edad, rol: 'Maestro' };
    this.profesores = [...this.profesores, temp].sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.form.profesorId = tempId;
    this.cerrarModalProfesor();

    this.asistenciaService.crearProfesor({ nombre, correo, edad, contrasena: this.nuevoProfesor.contrasena }).subscribe({
      next: (res) => {
        // Reemplazar id temporal con el real
        this.profesores = this.profesores.map(p => p.id === tempId ? { ...p, id: res.id } : p);
        this.form.profesorId = res.id;
      },
      error: (err) => {
        // Revertir
        this.profesores = this.profesores.filter(p => p.id !== tempId);
        this.form.profesorId = null;
        this.error = err?.error?.mensaje ?? '❌ Error al crear el profesor.';
      }
    });
  }
}
