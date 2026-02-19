use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};
use sqlx::PgPool;

pub async fn health_check(State(pool): State<PgPool>) -> Json<Value> {
    let db_ok = sqlx::query("SELECT 1").fetch_one(&pool).await.is_ok();
    let status = if db_ok { "ok" } else { "degraded" };

    Json(json!({
        "status": status,
        "service": "ops-hub-service",
        "database": if db_ok { "connected" } else { "disconnected" }
    }))
}
