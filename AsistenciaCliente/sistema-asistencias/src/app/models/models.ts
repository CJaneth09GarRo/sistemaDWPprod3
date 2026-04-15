export interface Usuario {
  id: number;
  correo: string;
  nombre: string;
  edad: number;
  rol: string;
}

export interface Materia {
  id: number;
  nombre_materia: string;
  horas_planificadas: number;
}

export interface Asistencia {
  id: number;
  usuarioId: number;
  materiaId: number;
  fecha: string;
  presente: boolean;
  horasImpartidas: number;
  horasAsistidas: number;
  observacion: string;
  usuarioNombre: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}