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
            if (string.IsNullOrWhiteSpace(role))
            {
                return false;
            }

            return role.Equals("Maestro", StringComparison.OrdinalIgnoreCase)
                || role.Equals("Administrador", StringComparison.OrdinalIgnoreCase)
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

        var roleNameColumn = await GetRoleNameColumnAsync(db);
        var roleProjection = string.IsNullOrWhiteSpace(roleNameColumn)
            ? "CAST(u.rol_id AS TEXT)"
            : $"r.{QuoteIdentifier(roleNameColumn)}";

        var sql = $@"SELECT
                    u.id,
                    u.correo,
                    u.nombre,
                    u.edad,
                    COALESCE({roleProjection}, 'Alumno') AS rol,
                    u.contrasenahash
                FROM usuario u
                LEFT JOIN rol r ON r.id = u.rol_id
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
app.MapPost("/api/auth/registro", async (RegistroDto dto, DapperContext db, ILogger<Program> logger) =>
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

        if (dto.Edad <= 0)
        {
            return Results.BadRequest(new { mensaje = "La edad debe ser mayor que cero" });
        }

        var existe = await db.ExecuteScalarAsync<long>(
            "SELECT COUNT(1) FROM usuario WHERE lower(correo) = @Correo",
            new { Correo = correo });

        if (existe > 0)
        {
            return Results.BadRequest(new { mensaje = "El correo ya está registrado" });
        }

        var rolRegistro = NormalizePublicRole(dto.Rol);
        var rolId = await ResolveRoleIdAsync(db, rolRegistro);
        if (rolId is null)
        {
            return Results.Problem(
                detail: "No se pudo resolver el rol para el registro de usuario.",
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Configuración de roles inválida");
        }

        // Guardar contraseña directamente (texto plano)
        var sql = @"INSERT INTO usuario (correo, nombre, edad, rol_id, contrasenahash)
                    VALUES (@Correo, @Nombre, @Edad, @RolId, @Contrasena)";

        await db.ExecuteAsync(sql, new
        {
            Correo = correo,
            Nombre = dto.Nombre.Trim(),
            Edad = dto.Edad,
            RolId = rolId.Value,
            Contrasena = dto.Contrasena
        });

        return Results.Ok(new { mensaje = "Usuario registrado exitosamente" });
    }
    catch (PostgresException ex) when (ex.SqlState == "23505")
    {
        logger.LogWarning(ex, "Intento de registro con correo duplicado: {Correo}", dto.Correo);
        return Results.BadRequest(new { mensaje = "El correo ya está registrado" });
    }
    catch (NpgsqlException)
    {
        logger.LogError("Error de base de datos al registrar usuario con correo {Correo}", dto.Correo);
        return Results.Problem(
            detail: "No se pudo conectar con la base de datos.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Servicio de base de datos no disponible");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error inesperado durante el registro del usuario con correo {Correo}", dto.Correo);
        return Results.Problem(
            detail: $"Ocurrió un error inesperado durante el registro: {ex.Message}",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

// ============ MATERIAS ============
app.MapGet("/api/materias", async (DapperContext db) =>
{
    var materias = await db.QueryAsync<Materia>("SELECT * FROM materia ORDER BY nombre_materia");
    return Results.Ok(materias);
}).RequireAuthorization();

// ============ ASISTENCIAS ============

// Obtener asistencias por materia y mes
app.MapGet("/api/asistencias/{materiaId}/{anio}/{mes}", async (int materiaId, int anio, int mes, DapperContext db) =>
{
    var presenceColumn = await GetAsistenciaPresenciaColumnAsync(db);
    var sql = $@"
        SELECT 
            a.id,
            a.usuario_id AS UsuarioId,
            a.materia_id AS MateriaId,
            a.fecha,
            a.{QuoteIdentifier(presenceColumn)} AS presente,
            a.horas_impartidas AS HorasImpartidas,
            a.horas_asistidas AS HorasAsistidas,
            a.observacion,
            u.nombre AS UsuarioNombre
        FROM asistencia a
        JOIN usuario u ON a.usuario_id = u.id
        WHERE a.materia_id = @MateriaId
          AND EXTRACT(YEAR FROM a.fecha) = @Anio
          AND EXTRACT(MONTH FROM a.fecha) = @Mes
        ORDER BY u.nombre, a.fecha";

    var result = await db.QueryAsync<AsistenciaDto>(sql, 
        new { MateriaId = materiaId, Anio = anio, Mes = mes });
    return Results.Ok(result);
}).RequireAuthorization();

// Registrar o actualizar asistencia
app.MapPost("/api/asistencias", async (AsistenciaRegistroDto dto, DapperContext db) =>
{
    try
    {
        var fecha = dto.Fecha.Date;
        var presenceColumn = await GetAsistenciaPresenciaColumnAsync(db);

        var filasActualizadas = await db.ExecuteAsync($@"
            UPDATE asistencia
            SET horas_impartidas = @HorasImpartidas,
                horas_asistidas = @HorasAsistidas,
                observacion = @Observacion,
                {QuoteIdentifier(presenceColumn)} = @Presente
            WHERE usuario_id = @UsuarioId
              AND materia_id = @MateriaId
              AND fecha = @Fecha",
            new
            {
                dto.UsuarioId,
                dto.MateriaId,
                Fecha = fecha,
                dto.HorasImpartidas,
                dto.HorasAsistidas,
                dto.Observacion,
                dto.Presente
            });

        if (filasActualizadas == 0)
        {
            await db.ExecuteAsync($@"
                INSERT INTO asistencia (usuario_id, materia_id, fecha, horas_impartidas, horas_asistidas, observacion, {QuoteIdentifier(presenceColumn)})
                VALUES (@UsuarioId, @MateriaId, @Fecha, @HorasImpartidas, @HorasAsistidas, @Observacion, @Presente)",
                new
                {
                    dto.UsuarioId,
                    dto.MateriaId,
                    Fecha = fecha,
                    dto.HorasImpartidas,
                    dto.HorasAsistidas,
                    dto.Observacion,
                    dto.Presente
                });
        }

        return Results.Ok(new { mensaje = "Asistencia registrada o actualizada" });
    }
    catch (NpgsqlException ex)
    {
        return Results.Problem(
            detail: $"No se pudo guardar la asistencia: {ex.Message}",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Error de base de datos");
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: $"Error inesperado al guardar la asistencia: {ex.Message}",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno");
    }
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

// Obtener alumnos por materia
app.MapGet("/api/alumnos-materia/{materiaId}", async (int materiaId, DapperContext db) =>
{
    var rolAlumnoId = await ResolveRoleIdAsync(db, "Alumno");
    if (rolAlumnoId is null)
    {
        return Results.Problem(
            detail: "No se encontró el rol 'Alumno' en la tabla de roles.",
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Configuración de roles inválida");
    }

    var roleNameColumn = await GetRoleNameColumnAsync(db);
    var roleProjection = string.IsNullOrWhiteSpace(roleNameColumn)
        ? "CAST(u.rol_id AS TEXT)"
        : $"r.{QuoteIdentifier(roleNameColumn)}";

    var sql = $@"
        SELECT DISTINCT u.id, u.nombre, u.correo, COALESCE({roleProjection}, 'Alumno') AS rol
        FROM usuario u
        LEFT JOIN rol r ON r.id = u.rol_id
        INNER JOIN asistencia a ON u.id = a.usuario_id
        WHERE u.rol_id = @RolAlumnoId AND a.materia_id = @MateriaId
        ORDER BY u.nombre";
    
    var result = await db.QueryAsync<Usuario>(sql, new { MateriaId = materiaId, RolAlumnoId = rolAlumnoId.Value });
    return Results.Ok(result);
}).RequireAuthorization("CanManageAttendance");

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

string QuoteIdentifier(string identifier)
{
    if (string.IsNullOrWhiteSpace(identifier) || identifier.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '_')))
    {
        throw new InvalidOperationException($"Identificador SQL no válido: {identifier}");
    }

    return $"\"{identifier}\"";
}

async Task<string?> GetRoleNameColumnAsync(DapperContext db)
{
    var columns = (await db.QueryAsync<string>(@"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rol'"))
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    var preferred = new[] { "nombre", "nombre_rol", "rol", "descripcion", "descripcion_rol" };
    return preferred.FirstOrDefault(columns.Contains);
}

async Task<int?> ResolveRoleIdAsync(DapperContext db, string role)
{
    var normalizedRole = NormalizePublicRole(role);
    var roleColumn = await GetRoleNameColumnAsync(db);
    if (string.IsNullOrWhiteSpace(roleColumn))
    {
        return await db.QueryFirstOrDefaultAsync<int?>("SELECT id FROM rol ORDER BY id LIMIT 1");
    }

    var sql = $@"SELECT id
                 FROM rol
                 WHERE lower({QuoteIdentifier(roleColumn)}) = lower(@Role)
                 LIMIT 1";
    var roleId = await db.QueryFirstOrDefaultAsync<int?>(sql, new { Role = normalizedRole });

    if (roleId is not null)
    {
        return roleId.Value;
    }

    if (normalizedRole.Equals("Secretario", StringComparison.OrdinalIgnoreCase))
    {
        roleId = await db.QueryFirstOrDefaultAsync<int?>(sql, new { Role = "Administrador" });
        if (roleId is not null)
        {
            return roleId.Value;
        }
    }

    return await db.QueryFirstOrDefaultAsync<int?>("SELECT id FROM rol ORDER BY id LIMIT 1");
}

async Task<string> GetAsistenciaPresenciaColumnAsync(DapperContext db)
{
    var columns = (await db.QueryAsync<string>(@"
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'asistencia'"))
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    if (columns.Contains("presente"))
    {
        return "presente";
    }

    if (columns.Contains("asistio"))
    {
        return "asistio";
    }

    throw new InvalidOperationException("La tabla asistencia no tiene columna de presencia compatible (presente/asistio).");
}

async Task PrepareDatabaseAsync(IServiceProvider services, ILogger logger)
{
    try
    {
        var db = services.GetRequiredService<DapperContext>();

        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_usuario_correo_lower ON usuario ((lower(correo)))");
        await db.ExecuteAsync("CREATE INDEX IF NOT EXISTS ix_asistencia_materia_fecha ON asistencia (materia_id, fecha)");
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
    public int HorasImpartidas { get; set; }
    public int HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
    public string UsuarioNombre { get; set; } = "";
}

public class AsistenciaRegistroDto
{
    public int UsuarioId { get; set; }
    public int MateriaId { get; set; }
    public DateTime Fecha { get; set; }
    public bool Presente { get; set; }
    public int HorasImpartidas { get; set; }
    public int HorasAsistidas { get; set; }
    public string Observacion { get; set; } = "";
}

// ============ DapperContext ============
public class DapperContext
{
    private readonly string _connectionString;

    public DapperContext(IConfiguration config)
    {
        var rawConnectionString = config.GetConnectionString("PostgreSQL") ??
            "Host=localhost;Database=prdct3;Username=postgres;Password=password";

        var csb = new NpgsqlConnectionStringBuilder(rawConnectionString)
        {
            Timeout = 3,
            CommandTimeout = 15
        };

        _connectionString = csb.ConnectionString;
    }

    private NpgsqlConnection CreateConnection() => new NpgsqlConnection(_connectionString);

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.QueryAsync<T>(sql, param);
    }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    public async Task<int> ExecuteAsync(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.ExecuteAsync(sql, param);
    }

    public async Task<T> ExecuteScalarAsync<T>(string sql, object? param = null)
    {
        using var conn = CreateConnection();
        return await conn.ExecuteScalarAsync<T>(sql, param);
    }
}