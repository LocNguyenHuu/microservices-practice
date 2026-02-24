// Ops Hub Service — the operational monitoring backbone of SkyTurn.
// Consumes ALL domain events from flight, turnaround, and crew services,
// logs them to an audit table, and runs periodic scheduler jobs to detect
// delayed turnarounds, stuck tasks, and crew shortages.

mod config;
mod db;
mod error;
mod events;
mod handlers;
mod models;
mod scheduler;

use axum::{routing, Extension, Router};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    // Structured JSON logging via tracing
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ops_hub_service=info,tower_http=info".into()),
        )
        .init();

    let config = config::Config::from_env();
    tracing::info!(port = config.server_port, "Starting ops-hub-service");

    // Database pool + migrations
    let pool = db::create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");
    db::run_migrations(&pool)
        .await
        .expect("Failed to run database migrations");

    let pool = Arc::new(pool);

    // SSE broadcast channel — events flow from RabbitMQ consumer to all connected dashboard clients
    let (broadcast_tx, _) = tokio::sync::broadcast::channel::<String>(256);

    // Start RabbitMQ event consumer as background task
    let consumer_pool = pool.clone();
    let consumer_tx = broadcast_tx.clone();
    let rabbitmq_url = config.rabbitmq_url.clone();
    tokio::spawn(async move {
        events::consumer::start_consumer(rabbitmq_url, consumer_pool, consumer_tx).await;
    });

    // Start scheduler jobs as background task
    let scheduler_pool = pool.clone();
    let scheduler_config = config.clone();
    tokio::spawn(async move {
        if let Err(e) = scheduler::jobs::start_scheduler(scheduler_config, scheduler_pool).await {
            tracing::error!("Scheduler failed to start: {e}");
        }
    });

    // HTTP routes
    let app = Router::new()
        .route("/health", routing::get(handlers::health::health_check))
        .route("/api/alerts", routing::get(handlers::alerts::list_alerts))
        .route("/api/alerts", routing::post(handlers::alerts::create_alert))
        .route("/api/alerts/{id}", routing::get(handlers::alerts::get_alert))
        .route(
            "/api/alerts/{id}",
            routing::patch(handlers::alerts::update_alert),
        )
        .route("/api/events", routing::get(handlers::events::list_events))
        .route(
            "/api/events/stream",
            routing::get(handlers::sse::event_stream),
        )
        .route("/auth/login", routing::post(handlers::auth::login))
        .route("/auth/me", routing::get(handlers::auth::me))
        .route("/auth/register", routing::post(handlers::auth::register))
        .route("/api/users", routing::get(handlers::auth::list_users))
        .layer(Extension(broadcast_tx))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state((*pool).clone());

    // Bind and serve with graceful shutdown
    let addr = format!("0.0.0.0:{}", config.server_port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind listener");
    tracing::info!("Listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server error");
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C handler");
    tracing::info!("Shutdown signal received");
}
