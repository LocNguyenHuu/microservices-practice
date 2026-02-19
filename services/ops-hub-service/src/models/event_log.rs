use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EventLogEntry {
    pub id: Uuid,
    pub event_type: String,
    pub source_service: String,
    pub payload: serde_json::Value,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct EventLogQuery {
    pub event_type: Option<String>,
    pub source_service: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
