using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Npgsql;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

// ============ CORS ============
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ============ JWT ============
var key = Encoding.UTF8.GetBytes("MiClaveSuperSecretaParaJWT2026Universidad123!");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanManageAttendance", policy =>
    {
        policy.RequireAssertion(context =>
        {
            var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
            if (string.IsNullOrWhiteSpace(role)) return false;
            return role.Equals("Maestro", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Administrador", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        });
    });

    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAssertion(context =>
        {
            var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
            if (string.IsNullOrWhiteSpace(role)) return false;
            return role.Equals("Administrador", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        });
    });
});
builder.Services.AddSingleton<DapperContext>();

var app = builder.Build();

app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();

await PrepareDatabaseAsync(app.Services, app.Logger);

// ============ LOGIN ============
app.MapPost("/api/auth/login", async (LoginDto login, DapperContext db) =>
{
    try
    {
        var correo = NormalizeEmail(login.Correo);
        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(login.Contrasena))
        {
            return Results.BadRequest(new { mensaje = "Correo y contraseña son obligatorios" });
        }

        var sql = @"SELECT u.id, u.correo, u.nombre, u.edad, r.nombre_rol AS rol, u.contrasenahash
                    FROM usuario u
                    JOIN rol r ON u.rol_id = r.id
                    WHERE lower(u.correo) = @Correo";
        var usuario = await db.QueryFirstOrDefaultAsync<Usuario>(sql, new { Correo = correo });

        if (usuario is null)
        {
            return Results.Unauthorized();
        }

        // Verificar contraseña (texto plano)
        if (usuario.Contrasenahash != login.Contrasena)
        {
            return Results.Unauthorized();
        }

        var token = GenerarToken(usuario);
        return Results.Ok(new
        {
            token,
            usuario = new
            {
                usuario.Id,
                usuario.Nombre,
                usuario.Correo,
                usuario.Rol
            }
        });
    }
    catch (NpgsqlException)
    {
        return Results.Problem(
            detail: "No se pudo conectar con la base de datos.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Servicio de base de datos no disponible");
    }
    catch (Exception)
    {
        return Results.Problem(
            detail: "Ocurrió un error inesperado durante el inicio de sesión.",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
});

// ============ REGISTRO ============
app.MapPost("/api/auth/registro", async (RegistroDto dto, DapperContext db) =>
{
    try
    {
        var correo = NormalizeEmail(dto.Correo);
        if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(dto.Nombre) || string.IsNullOrWhiteSpace(dto.Contrasena))
        {
            return Results.BadRequest(new { mensaje = "Correo, nombre y contraseña son obligatorios" });
        }

        if (dto.Contrasena.Length < 6)
        {
            return Results.BadRequest(new { mensaje = "La contraseña debe tener al menos 6 caracteres" });
        }

        var existe = await db.ExecuteScalarAsync<long>(
            "SELECT COUNT(1) FROM usuario WHERE lower(correo) = @Correo",
            new { Correo = correo });

        if (existe > 0)
        {
            return Results.BadRequest(new { mensaje = "El correo ya está registrado" });
        }

        var rolNombre = NormalizePublicRole(dto.Rol);

        var rolId = await db.ExecuteScalarAsync<int?>(
            "SELECT id FROM rol WHERE lower(nombre_rol) = lower(@Nombre)",
            new { Nombre = rolNombre });

        if (rolId is null)
        {
            return Results.BadRequest(new { mensaje = "Rol no válido" });
        }

        // Guardar contraseña directamente (texto plano)
        var sql = @"INSERT INTO usuario (correo, nombre, edad, rol_id, contrasenahash)
                    VALUES (@Correo, @Nombre, @Edad, @RolId, @Contrasena)";

        await db.ExecuteAsync(sql, new
        {
            Correo = correo,
            Nombre = dto.Nombre.Trim(),
            Edad = dto.Edad,
            RolId = rolId,
            Contrasena = dto.Contrasena
        });

        return Results.Ok(new { mensaje = "Usuario registrado exitosamente" });
    }
    catch (NpgsqlException)
    {
        return Results.Problem(
            detail: "No se pudo conectar con la base de datos.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Servicio de base de datos no disponible");
    }
    catch (Exception)
    {
        return Results.Problem(
            detail: "Ocurrió un error inesperado durante el registro.",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

// ============ MATERIAS ============
app.MapGet("/api/materias", async (DapperContext db) =>
{
    var sql = @"
        SELECT DISTINCT ON (m.id)
            m.id, m.nombre_materia, m.horas_planificadas,
            u.id   AS ProfesorId,
            u.nombre AS ProfesorNombre
        FROM materia m
        LEFT JOIN maestro_materia mm ON mm.materia_id = m.id AND mm.activo = true
        LEFT JOIN usuario u ON mm.maestro_id = u.id
        ORDER BY m.id, mm.fecha_asignacion DESC";
    var materias = await db.QueryAsync<MateriaDetalle>(sql);
    return Results.Ok(materias);
}).RequireAuthorization();

app.MapPost("/api/materias", async (CrearMateriaDto dto, DapperContext db) =>
{
    if (string.IsNullOrWhiteSpace(dto.NombreMateria))
        return Results.BadRequest(new { mensaje = "El nombre de la materia es obligatorio" });

    var materiaId = await db.ExecuteScalarAsync<int>(
        @"INSERT INTO materia (nombre_materia, horas_planificadas)
          VALUES (@Nombre, @Horas) RETURNING id",
        new { Nombre = dto.NombreMateria.Trim(), Horas = dto.HorasPlanificadas });

    if (dto.ProfesorId.HasValue)
    {
        await db.ExecuteAsync(
            @"INSERT INTO maestro_materia (maestro_id, materia_id, fecha_asignacion, activo)
              VALUES (@MaestroId, @MateriaId, CURRENT_DATE, true)",
            new { MaestroId = dto.ProfesorId.Value, MateriaId = materiaId });
    }

    return Results.Ok(new { id = materiaId, mensaje = "Materia creada exitosamente" });
}).RequireAuthorization("AdminOnly");

app.MapPut("/api/materias/{id}", async (int id, EditarMateriaDto dto, DapperContext db) =>
{
    if (string.IsNullOrWhiteSpace(dto.NombreMateria))
        return Results.BadRequest(new { mensaje = "El nombre de la materia es obligatorio" });

    var filas = await db.ExecuteAsync(
        "UPDATE materia SET nombre_materia = @Nombre, horas_planificadas = @Horas WHERE id = @Id",
        new { Nombre = dto.NombreMateria.Trim(), Horas = dto.HorasPlanificadas, Id = id });

    if (filas == 0) return Results.NotFound(new { mensaje = "Materia no encontrada" });

    // Reasignar profesor: desactivar asignaciones previas e insertar la nueva
    await db.ExecuteAsync("UPDATE maestro_materia SET activo = false WHERE materia_id = @Id", new { Id = id });
    if (dto.ProfesorId.HasValue)
    {
        await db.ExecuteAsync(
            @"INSERT INTO maestro_materia (maestro_id, materia_id, fecha_asignacion, activo)
              VALUES (@MaestroId, @MateriaId, CURRENT_DATE, true)
              ON CONFLICT (maestro_id, materia_id, grupo_id, periodo_academico_id) DO UPDATE SET activo = true",
            new { MaestroId = dto.ProfesorId.Value, MateriaId = id });
    }

    return Results.Ok(new { mensaje = "Materia actualizada" });
}).RequireAuthorization("AdminOnly");

app.MapDelete("/api/materias/{id}", async (int id, DapperContext db) =>
{
    try
    {
        await db.ExecuteAsync("DELETE FROM asistencia WHERE materia_id = @Id", new { Id = id });
        await db.ExecuteAsync("DELETE FROM maestro_materia WHERE materia_id = @Id", new { Id = id });
        await db.ExecuteAsync("DELETE FROM alumno_materia WHERE materia_id = @Id", new { Id = id });
        var filas = await db.ExecuteAsync("DELETE FROM materia WHERE id = @Id", new { Id = id });
        if (filas == 0) return Results.NotFound(new { mensaje = "Materia no encontrada" });
        return Results.Ok(new { mensaje = "Materia eliminada" });
    }
    catch (Exception)
    {
        return Results.Problem("No se pudo eliminar la materia.", statusCode: 500);
    }
}).RequireAuthorization("AdminOnly");

// ============ PROFESORES ============
app.MapGet("/api/profesores", async (DapperContext db) =>
{
    var sql = @"SELECT u.id, u.nombre, u.correo, u.edad, r.nombre_rol AS rol
                FROM usuario u
                JOIN rol r ON u.rol_id = r.id
                WHERE r.nombre_rol = 'Maestro'
                ORDER BY u.nombre";
    var result = await db.QueryAsync<Usuario>(sql);
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/profesores", async (CrearUsuarioDto dto, DapperContext db) =>
{
    var correo = (dto.Correo ?? "").Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(dto.Nombre) || string.IsNullOrWhiteSpace(dto.Contrasena))
        return Results.BadRequest(new { mensaje = "Correo, nombre y contraseña son obligatorios" });

    if (await db.ExecuteScalarAsync<long>("SELECT COUNT(1) FROM usuario WHERE lower(correo) = @Correo", new { Correo = correo }) > 0)
        return Results.BadRequest(new { mensaje = "El correo ya está registrado" });

    // Obtiene rol_id e inserta en una sola query
    var nuevoId = await db.ExecuteScalarAsync<int?>(
        @"INSERT INTO usuario (correo, nombre, edad, rol_id, contrasenahash)
          SELECT @Correo, @Nombre, @Edad, r.id, @Contrasena FROM rol r WHERE r.nombre_rol = 'Maestro'
          RETURNING id",
        new { Correo = correo, Nombre = dto.Nombre.Trim(), Edad = dto.Edad, Contrasena = dto.Contrasena });

    if (nuevoId is null) return Results.Problem("Rol Maestro no encontrado", statusCode: 500);
    return Results.Ok(new { id = nuevoId, mensaje = "Profesor creado exitosamente" });
}).RequireAuthorization("AdminOnly");

// ============ ALUMNOS ============
app.MapGet("/api/alumnos", async (DapperContext db) =>
{
    var sql = @"SELECT u.id, u.nombre, u.correo, u.edad, r.nombre_rol AS rol
                FROM usuario u
                JOIN rol r ON u.rol_id = r.id
                WHERE r.nombre_rol = 'Alumno'
                ORDER BY u.nombre";
    var result = await db.QueryAsync<Usuario>(sql);
    return Results.Ok(result);
}).RequireAuthorization("AdminOnly");

app.MapPost("/api/alumnos", async (CrearUsuarioDto dto, DapperContext db) =>
{
    var correo = (dto.Correo ?? "").Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(correo) || string.IsNullOrWhiteSpace(dto.Nombre) || string.IsNullOrWhiteSpace(dto.Contrasena))
        return Results.BadRequest(new { mensaje = "Correo, nombre y contraseña son obligatorios" });

    if (await db.ExecuteScalarAsync<long>("SELECT COUNT(1) FROM usuario WHERE lower(correo) = @Correo", new { Correo = correo }) > 0)
        return Results.BadRequest(new { mensaje = "El correo ya está registrado" });

    var nuevoId = await db.ExecuteScalarAsync<int?>(
        @"INSERT INTO usuario (correo, nombre, edad, rol_id, contrasenahash)
          SELECT @Correo, @Nombre, @Edad, r.id, @Contrasena FROM rol r WHERE r.nombre_rol = 'Alumno'
          RETURNING id",
        new { Correo = correo, Nombre = dto.Nombre.Trim(), Edad = dto.Edad, Contrasena = dto.Contrasena });

    if (nuevoId is null) return Results.Problem("Rol Alumno no encontrado", statusCode: 500);
    return Results.Ok(new { id = nuevoId, mensaje = "Alumno creado exitosamente" });
}).RequireAuthorization("AdminOnly");

app.MapPut("/api/alumnos/{id}", async (int id, EditarUsuarioDto dto, DapperContext db) =>
{
    if (string.IsNullOrWhiteSpace(dto.Nombre))
        return Results.BadRequest(new { mensaje = "El nombre es obligatorio" });

    var filas = await db.ExecuteAsync(
        "UPDATE usuario SET nombre = @Nombre, edad = @Edad WHERE id = @Id",
        new { Nombre = dto.Nombre.Trim(), Edad = dto.Edad, Id = id });

    if (filas == 0) return Results.NotFound(new { mensaje = "Alumno no encontrado" });
    return Results.Ok(new { mensaje = "Alumno actualizado" });
}).RequireAuthorization("AdminOnly");

app.MapDelete("/api/alumnos/{id}", async (int id, DapperContext db) =>
{
    try
    {
        await db.ExecuteAsync("DELETE FROM asistencia WHERE usuario_id = @Id", new { Id = id });
        await db.ExecuteAsync("DELETE FROM maestro_materia WHERE maestro_id = @Id", new { Id = id });
        await db.ExecuteAsync("DELETE FROM alumno_materia WHERE alumno_id = @Id", new { Id = id });
        var filas = await db.ExecuteAsync("DELETE FROM usuario WHERE id = @Id", new { Id = id });
        if (filas == 0) return Results.NotFound(new { mensaje = "Alumno no encontrado" });
        return Results.Ok(new { mensaje = "Alumno eliminado" });
    }
    catch (Exception)
    {
        return Results.Problem("No se pudo eliminar el alumno.", statusCode: 500);
    }
}).RequireAuthorization("AdminOnly");

// ============ ASISTENCIAS ============

// Obtener asistencias por materia y mes (Alumno solo ve las suyas)
app.MapGet("/api/asistencias/{materiaId}/{anio}/{mes}", async (int materiaId, int anio, int mes, DapperContext db, HttpContext httpContext) =>
{
    var rol = httpContext.User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    var esAlumno = rol.Equals("Alumno", StringComparison.OrdinalIgnoreCase);
    int.TryParse(httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var usuarioId);

    var sql = @"
        SELECT
            a.id,
            a.usuario_id AS UsuarioId,
            a.materia_id AS MateriaId,
            a.fecha,
            a.presente,
            a.horas_impartidas AS HorasImpartidas,
            a.horas_asistidas AS HorasAsistidas,
            a.observacion,
            u.nombre AS UsuarioNombre
        FROM asistencia a
        JOIN usuario u ON a.usuario_id = u.id
        WHERE a.materia_id = @MateriaId
          AND EXTRACT(YEAR FROM a.fecha) = @Anio
          AND EXTRACT(MONTH FROM a.fecha) = @Mes"
        + (esAlumno ? " AND a.usuario_id = @UsuarioId" : "") +
        " ORDER BY u.nombre, a.fecha";

    var result = await db.QueryAsync<AsistenciaDto>(sql,
        new { MateriaId = materiaId, Anio = anio, Mes = mes, UsuarioId = usuarioId });
    return Results.Ok(result);
}).RequireAuthorization();

// Registrar o actualizar asistencia
app.MapPost("/api/asistencias", async (AsistenciaRegistroDto dto, DapperContext db) =>
{
    var sql = @"
        INSERT INTO asistencia (usuario_id, materia_id, fecha, horas_impartidas, horas_asistidas, observacion, presente)
        VALUES (@UsuarioId, @MateriaId, @Fecha, @HorasImpartidas, @HorasAsistidas, @Observacion, @Presente)
        ON CONFLICT (usuario_id, materia_id, fecha)
        DO UPDATE SET 
            horas_impartidas = EXCLUDED.horas_impartidas,
            horas_asistidas = EXCLUDED.horas_asistidas,
            observacion = EXCLUDED.observacion,
            presente = EXCLUDED.presente";

    await db.ExecuteAsync(sql, dto);
    return Results.Ok(new { mensaje = "Asistencia registrada o actualizada" });
}).RequireAuthorization("CanManageAttendance");

// Eliminar asistencia
app.MapDelete("/api/asistencias/{id}", async (int id, DapperContext db) =>
{
    var filasAfectadas = await db.ExecuteAsync("DELETE FROM asistencia WHERE id = @Id", new { Id = id });
    
    if (filasAfectadas == 0)
    {
        return Results.NotFound(new { mensaje = "Asistencia no encontrada" });
    }
    
    return Results.Ok(new { mensaje = "Asistencia eliminada" });
    }).RequireAuthorization("CanManageAttendance");

// Alumnos inscritos en la materia
app.MapGet("/api/alumnos-materia/{materiaId}", async (int materiaId, DapperContext db) =>
{
    var sql = @"
        SELECT u.id, u.nombre, u.correo, r.nombre_rol AS rol
        FROM usuario u
        JOIN alumno_materia am ON am.alumno_id = u.id
        JOIN rol r ON u.rol_id = r.id
        WHERE am.materia_id = @MateriaId
        ORDER BY u.nombre";
    var result = await db.QueryAsync<Usuario>(sql, new { MateriaId = materiaId });
    return Results.Ok(result);
}).RequireAuthorization("CanManageAttendance");

// Alumnos NO inscritos en la materia (para el selector de inscripción)
app.MapGet("/api/alumnos-disponibles/{materiaId}", async (int materiaId, DapperContext db) =>
{
    var sql = @"
        SELECT u.id, u.nombre, u.correo, r.nombre_rol AS rol
        FROM usuario u
        JOIN rol r ON u.rol_id = r.id
        WHERE r.nombre_rol = 'Alumno'
          AND u.id NOT IN (SELECT alumno_id FROM alumno_materia WHERE materia_id = @MateriaId)
        ORDER BY u.nombre";
    var result = await db.QueryAsync<Usuario>(sql, new { MateriaId = materiaId });
    return Results.Ok(result);
}).RequireAuthorization("AdminOnly");

// Inscribir alumno a materia
app.MapPost("/api/alumno-materia", async (InscribirAlumnoDto dto, DapperContext db) =>
{
    await db.ExecuteAsync(
        "INSERT INTO alumno_materia (alumno_id, materia_id) VALUES (@AlumnoId, @MateriaId) ON CONFLICT DO NOTHING",
        new { dto.AlumnoId, dto.MateriaId });
    return Results.Ok(new { mensaje = "Alumno inscrito" });
}).RequireAuthorization("AdminOnly");

// Desinscribir alumno de materia
app.MapDelete("/api/alumno-materia/{alumnoId}/{materiaId}", async (int alumnoId, int materiaId, DapperContext db) =>
{
    await db.ExecuteAsync(
        "DELETE FROM alumno_materia WHERE alumno_id = @AlumnoId AND materia_id = @MateriaId",
        new { AlumnoId = alumnoId, MateriaId = materiaId });
    return Results.Ok(new { mensaje = "Inscripción eliminada" });
}).RequireAuthorization("AdminOnly");

app.Run();

// ============ FUNCIONES ============
string NormalizeEmail(string? email)
{
    return (email ?? string.Empty).Trim().ToLowerInvariant();
}

string NormalizePublicRole(string? role)
{
    var normalized = (role ?? string.Empty).Trim();
    if (normalized.Equals("Maestro", StringComparison.OrdinalIgnoreCase))
    {
        return "Maestro";
    }

    if (normalized.Equals("Secretario", StringComparison.OrdinalIgnoreCase))
    {
        return "Secretario";
    }

    // Bloquea escalamiento de privilegios por registro público.
    return "Alumno";
}

async Task PrepareDatabaseAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        var db = services.GetRequiredService<DapperContext>();
        // Columnas agregadas después del esquema original — se aplican automáticamente en cualquier máquina
        await db.ExecuteAsync("ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS presente boolean NOT NULL DEFAULT false");
        // Tabla de inscripciones alumno ↔ materia
        await db.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS alumno_materia (
                id SERIAL PRIMARY KEY,
                alumno_id INTEGER NOT NULL REFERENCES usuario(id),
                materia_id INTEGER NOT NULL REFERENCES materia(id),
                UNIQUE(alumno_id, materia_id)
            )");
        // Índices para acelerar las consultas frecuentes
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_usuario_correo_lower ON usuario ((lower(correo)))");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_asistencia_materia_fecha ON asistencia (materia_id, fecha)");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_alumno_materia_materia ON alumno_materia (materia_id)");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_maestro_materia_materia ON maestro_materia (materia_id)");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_usuario_rol ON usuario (rol_id)");
        await db.ExecuteScalarAsync<int>("SELECT 1");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "No se pudo preparar la base de datos al iniciar la API");
    }
}

string GenerarToken(Usuario usuario)
{
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Email, usuario.Correo),
        new Claim(ClaimTypes.Name, usuario.Nombre),
        new Claim(ClaimTypes.Role, usuario.Rol ?? "Usuario")
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("MiClaveSuperSecretaParaJWT2026Universidad123!"));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer: null,
        audience: null,
        claims: claims,
        expires: DateTime.Now.AddHours(8),
        signingCredentials: creds);

    return new JwtSecurityTokenHandler().WriteToken(token);
}

// ============ CLASES ============
public class Usuario
{
    public int Id { get; set; }
    public string Correo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
    public string Rol { get; set; } = "Alumno";
    public string Contrasenahash { get; set; } = "";
}

public class Materia
{
    public int Id { get; set; }
    public string Nombre_materia { get; set; } = "";
    public int Horas_planificadas { get; set; }
}

public class LoginDto
{
    public string Correo { get; set; } = "";
    public string Contrasena { get; set; } = "";
}

public class RegistroDto
{
    public string Correo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
    public string Contrasena { get; set; } = "";
    public string Rol { get; set; } = "Alumno";
}

public class AsistenciaDto
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int MateriaId { get; set; }
    public DateTime Fecha { get; set; }
    public bool Presente { get; set; }
    public decimal HorasImpartidas { get; set; }
    public decimal HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
    public string UsuarioNombre { get; set; } = "";
}

public class AsistenciaRegistroDto
{
    public int UsuarioId { get; set; }
    public int MateriaId { get; set; }
    public DateTime Fecha { get; set; }
    public bool Presente { get; set; }
    public decimal HorasImpartidas { get; set; }
    public decimal HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
}

public class MateriaDetalle
{
    public int Id { get; set; }
    public string Nombre_materia { get; set; } = "";
    public int Horas_planificadas { get; set; }
    public int? ProfesorId { get; set; }
    public string? ProfesorNombre { get; set; }
}

public class CrearMateriaDto
{
    public string NombreMateria { get; set; } = "";
    public int HorasPlanificadas { get; set; }
    public int? ProfesorId { get; set; }
}

public class CrearUsuarioDto
{
    public string Correo { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
    public string Contrasena { get; set; } = "";
}

public class InscribirAlumnoDto
{
    public int AlumnoId { get; set; }
    public int MateriaId { get; set; }
}

public class EditarMateriaDto
{
    public string NombreMateria { get; set; } = "";
    public int HorasPlanificadas { get; set; }
    public int? ProfesorId { get; set; }
}

public class EditarUsuarioDto
{
    public string Nombre { get; set; } = "";
    public int Edad { get; set; }
}

// ============ DapperContext ============
public class DapperContext : IAsyncDisposable
{
    private readonly NpgsqlDataSource _dataSource;

    public DapperContext(IConfiguration config)
    {
        var cs = config.GetConnectionString("PostgreSQL") ??
            "Host=localhost;Database=prdct3;Username=postgres;Password=password";
        _dataSource = NpgsqlDataSource.Create(cs);
    }

    private async Task<NpgsqlConnection> GetConnectionAsync()
        => await _dataSource.OpenConnectionAsync();

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null)
    {
        await using var conn = await GetConnectionAsync();
        return await conn.QueryAsync<T>(sql, param);
    }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null)
    {
        await using var conn = await GetConnectionAsync();
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    public async Task<int> ExecuteAsync(string sql, object? param = null)
    {
        await using var conn = await GetConnectionAsync();
        return await conn.ExecuteAsync(sql, param);
    }

    public async Task<T> ExecuteScalarAsync<T>(string sql, object? param = null)
    {
        await using var conn = await GetConnectionAsync();
        return await conn.ExecuteScalarAsync<T>(sql, param);
    }

    public async ValueTask DisposeAsync() => await _dataSource.DisposeAsync();
}