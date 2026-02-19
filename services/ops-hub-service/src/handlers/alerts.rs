use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::alert::{Alert, AlertQuery, CreateAlertRequest, UpdateAlertRequest};

pub async fn create_alert(
    State(pool): State<PgPool>,
    Json(req): Json<CreateAlertRequest>,
) -> Result<(StatusCode, Json<Alert>), AppError> {
    let alert = sqlx::query_as::<_, Alert>(
        r#"INSERT INTO alerts (alert_type, severity, flight_id, turnaround_id, title, description)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(&req.alert_type)
    .bind(&req.severity)
    .bind(req.flight_id)
    .bind(req.turnaround_id)
    .bind(&req.title)
    .bind(&req.description)
    .fetch_one(&pool)
    .await?;

    tracing::info!(
        alert_type = %alert.alert_type,
        severity = %alert.severity,
        alert_id = %alert.id,
        "Alert created"
    );

    Ok((StatusCode::CREATED, Json(alert)))
}

pub async fn list_alerts(
    State(pool): State<PgPool>,
    Query(params): Query<AlertQuery>,
) -> Result<Json<Vec<Alert>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let alerts = sqlx::query_as::<_, Alert>(
        r#"SELECT * FROM alerts
           WHERE ($1::text IS NULL OR status = $1)
             AND ($2::text IS NULL OR severity = $2)
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(params.status.as_deref())
    .bind(params.severity.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await?;

    Ok(Json(alerts))
}

pub async fn get_alert(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Alert>, AppError> {
    let alert = sqlx::query_as::<_, Alert>("SELECT * FROM alerts WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Alert {id} not found")))?;

    Ok(Json(alert))
}

pub async fn update_alert(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAlertRequest>,
) -> Result<Json<Alert>, AppError> {
    let alert = sqlx::query_as::<_, Alert>(
        r#"UPDATE alerts
           SET status = COALESCE($2, status),
               resolved_at = COALESCE($3, resolved_at)
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(req.status.as_deref())
    .bind(req.resolved_at)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Alert {id} not found")))?;

    tracing::info!(alert_id = %id, status = %alert.status, "Alert updated");
    Ok(Json(alert))
}
