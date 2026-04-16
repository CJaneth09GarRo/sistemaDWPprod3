# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sistema de Asistencias — a university attendance tracking system. Full-stack app with:
- **Backend**: ASP.NET Core 8 Minimal API (`AsistenciaAPI/`)
- **Frontend**: Angular 21 SPA (`AsistenciaCliente/sistema-asistencias/`)
- **Database**: PostgreSQL (`prdct3` database)

## Commands

### Backend (from `AsistenciaAPI/`)
```bash
dotnet run          # Start API on http://localhost:5091
dotnet build        # Build only
dotnet watch run    # Hot-reload dev mode
```

### Frontend (from `AsistenciaCliente/sistema-asistencias/`)
```bash
npm start           # or: ng serve — runs on http://localhost:4200
npm run build       # Production build
ng test             # Run unit tests (Karma/Jasmine)
ng test --include="**/auth.service.spec.ts"  # Run a single test file
```

## Architecture

### Backend — single-file Minimal API
All API logic lives in `AsistenciaAPI/Program.cs`. There are no separate controllers, services, or repositories. The file contains:
- Route handlers (`app.MapGet/MapPost/MapDelete`) inline with their SQL
- All DTOs and model classes at the bottom of the file
- `DapperContext` — thin wrapper over `NpgsqlConnection` that opens/closes a connection per query

Dependencies: **Dapper** (query mapping), **Npgsql** (PostgreSQL driver), **Microsoft.AspNetCore.Authentication.JwtBearer** (auth).

### Database schema (PostgreSQL)
Three tables (must exist before running the API — no migrations):
- `usuario(id, correo, nombre, edad, rol, contrasenahash)` — roles: `Alumno`, `Maestro`, `Secretario`, `Administrador`
- `materia(id, nombre_materia, horas_planificadas)`
- `asistencia(id, usuario_id, materia_id, fecha, presente, horas_impartidas, horas_asistidas, observacion)` — unique constraint on `(usuario_id, materia_id, fecha)` for upsert

Connection string default: `Host=localhost;Database=prdct3;Username=postgres;Password=password` (overridable in `appsettings.json`).

> **Note**: Passwords are stored as plain text in `contrasenahash` despite the column name.

### Authorization
- All endpoints except `/api/auth/login`, `/api/auth/registro`, and `/api/health` require a valid JWT (`RequireAuthorization()`).
- Write operations (`POST /api/asistencias`, `DELETE /api/asistencias/{id}`, `GET /api/alumnos-materia/{id}`) additionally require the `CanManageAttendance` policy — roles `Maestro`, `Administrador`, or `Admin`.
- Public registration can only create `Alumno`, `Maestro`, or `Secretario` accounts (`NormalizePublicRole` blocks escalation to Admin).

### Frontend — Angular standalone components
No Angular modules; uses standalone components with `provideRouter` and `provideHttpClient` in `app.config.ts`.

Key structure:
- `services/auth.service.ts` — JWT login/logout, stores token and user in `localStorage`, exposes `canManageAttendance()` for role checks
- `services/asistencia.service.ts` — wraps all attendance/materia API calls, manually attaches `Authorization: Bearer` header
- `guards/auth.guard.ts` — redirects unauthenticated users to `/login`
- `models/models.ts` — all shared interfaces (`Usuario`, `Materia`, `Asistencia`, `AlumnoMateria`, `LoginResponse`)
- Routes: `''` → Portada, `/login`, `/registro`, `/dashboard` (guarded), `/asistencia` (guarded)

### API base URL
Hardcoded to `http://localhost:5091` in both `auth.service.ts` and `asistencia.service.ts`. Change both when deploying.
