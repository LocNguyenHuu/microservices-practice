// SSE (Server-Sent Events) endpoint for real-time event streaming.
// Broadcasts all domain events consumed from RabbitMQ to connected dashboard clients.
// Supports optional JWT authentication via query parameter.

use axum::{
    extract::{Extension, Query},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use serde::Deserialize;
use std::convert::Infallible;
use tokio::sync::broadcast;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

use crate::error::AppError;
use crate::models::user::Claims;

const JWT_SECRET: &str = "skyturn-jwt-secret-change-in-production";

#[derive(Deserialize)]
pub struct SseQuery {
    pub token: Option<String>,
}

pub async fn event_stream(
    Extension(tx): Extension<broadcast::Sender<String>>,
    Query(params): Query<SseQuery>,
) -> Result<impl IntoResponse, AppError> {
    // Validate JWT if provided (allows unauthenticated access for dev convenience)
    if let Some(ref token) = params.token {
        validate_token(token)?;
    }

    let rx = tx.subscribe();
    let stream = BroadcastStream::new(rx)
        .filter_map(|result| result.ok())
        .map(|data| -> Result<Event, Infallible> { Ok(Event::default().data(data)) });

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("ping"),
    ))
}

fn validate_token(token: &str) -> Result<Claims, AppError> {
    let data = jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|e| AppError::BadRequest(format!("Invalid token: {e}")))?;

    Ok(data.claims)
}
