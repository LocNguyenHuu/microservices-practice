use axum::extract::{Query, State};
use axum::Json;
use sqlx::PgPool;

use crate::error::AppError;
use crate::models::event_log::{EventLogEntry, EventLogQuery};

pub async fn list_events(
    State(pool): State<PgPool>,
    Query(params): Query<EventLogQuery>,
) -> Result<Json<Vec<EventLogEntry>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let events = sqlx::query_as::<_, EventLogEntry>(
        r#"SELECT * FROM event_log
           WHERE ($1::text IS NULL OR event_type = $1)
             AND ($2::text IS NULL OR source_service = $2)
           ORDER BY received_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(params.event_type.as_deref())
    .bind(params.source_service.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await?;

    Ok(Json(events))
}
