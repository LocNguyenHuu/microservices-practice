use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::PgPool;

use crate::error::AppError;
use crate::models::user::{
    Claims, LoginRequest, LoginResponse, RegisterRequest, User, UserQuery, UserResponse,
};

const JWT_SECRET: &str = "skyturn-jwt-secret-change-in-production";
const TOKEN_EXPIRY_HOURS: i64 = 24;

pub async fn login(
    State(pool): State<PgPool>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = $1 AND is_active = true",
    )
    .bind(&req.username)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Invalid username or password".into()))?;

    // Verify password using bcrypt
    let valid = bcrypt::verify(&req.password, &user.password_hash)
        .map_err(|_| AppError::BadRequest("Invalid username or password".into()))?;

    if !valid {
        return Err(AppError::BadRequest("Invalid username or password".into()));
    }

    // Generate JWT
    let expiry = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(TOKEN_EXPIRY_HOURS))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp: expiry,
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| AppError::BadRequest(format!("Failed to generate token: {e}")))?;

    tracing::info!(username = %user.username, role = %user.role, "User logged in");

    Ok(Json(LoginResponse {
        token,
        user: user.into(),
    }))
}

pub async fn me(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
) -> Result<Json<UserResponse>, AppError> {
    let token = extract_token(&headers)?;
    let claims = decode_token(&token)?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(uuid::Uuid::parse_str(&claims.sub).map_err(|_| {
            AppError::BadRequest("Invalid token".into())
        })?)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(user.into()))
}

pub async fn register(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    // Only admins can register new users
    let token = extract_token(&headers)?;
    let claims = decode_token(&token)?;
    if claims.role != "admin" {
        return Err(AppError::BadRequest("Only admins can register users".into()));
    }

    let role = req.role.unwrap_or_else(|| "viewer".into());
    let valid_roles = ["admin", "ops_manager", "crew_supervisor", "ground_crew", "viewer"];
    if !valid_roles.contains(&role.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid role: {role}. Must be one of: {}", valid_roles.join(", ")
        )));
    }

    let password_hash = bcrypt::hash(&req.password, 12)
        .map_err(|e| AppError::BadRequest(format!("Failed to hash password: {e}")))?;

    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO users (username, password_hash, email, role)
           VALUES ($1, $2, $3, $4)
           RETURNING *"#,
    )
    .bind(&req.username)
    .bind(&password_hash)
    .bind(req.email.as_deref())
    .bind(&role)
    .fetch_one(&pool)
    .await?;

    tracing::info!(username = %user.username, role = %user.role, "User registered");

    Ok((StatusCode::CREATED, Json(user.into())))
}

pub async fn list_users(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Query(params): Query<UserQuery>,
) -> Result<Json<Vec<UserResponse>>, AppError> {
    // Only admins can list users
    let token = extract_token(&headers)?;
    let claims = decode_token(&token)?;
    if claims.role != "admin" {
        return Err(AppError::BadRequest("Only admins can list users".into()));
    }

    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await?;

    Ok(Json(users.into_iter().map(Into::into).collect()))
}

fn extract_token(headers: &axum::http::HeaderMap) -> Result<String, AppError> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::BadRequest("Missing or invalid Authorization header".into()))
}

fn decode_token(token: &str) -> Result<Claims, AppError> {
    let data = jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|e| AppError::BadRequest(format!("Invalid token: {e}")))?;

    Ok(data.claims)
}
