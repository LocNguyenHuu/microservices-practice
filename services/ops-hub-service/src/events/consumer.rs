// Consumes ALL domain events from all services via wildcard routing keys.
// Every event is logged to the event_log table for audit/debugging purposes.
// Binds to ops-hub-all-queue with flight.#, turnaround.#, crew.# routing keys.

use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, ExchangeDeclareOptions, QueueBindOptions,
        QueueDeclareOptions,
    },
    types::FieldTable,
    Channel, Connection, ConnectionProperties, ExchangeKind,
};
use sqlx::PgPool;
use std::sync::Arc;

const QUEUE_NAME: &str = "ops-hub-all-queue";

// Exchanges to declare and bind with wildcard routing keys
const EXCHANGES: &[(&str, &str)] = &[
    ("flight.events", "flight.#"),
    ("turnaround.events", "turnaround.#"),
    ("crew.events", "crew.#"),
];

// Derives the source service name from an event type prefix.
// "flight.arrived" → "flight-service", "turnaround.started" → "turnaround-service"
fn source_service_from_event_type(event_type: &str) -> &str {
    match event_type.split('.').next() {
        Some("flight") => "flight-service",
        Some("turnaround") => "turnaround-service",
        Some("crew") => "crew-service",
        _ => "unknown",
    }
}

// Connects to RabbitMQ with retry logic. Attempts up to 5 times with
// exponential backoff (1s, 2s, 4s, 8s, 16s) before giving up.
async fn connect_with_retry(url: &str) -> Result<Connection, lapin::Error> {
    let mut delay = std::time::Duration::from_secs(1);
    for attempt in 1..=5 {
        match Connection::connect(url, ConnectionProperties::default()).await {
            Ok(conn) => {
                tracing::info!("RabbitMQ connected on attempt {attempt}");
                return Ok(conn);
            }
            Err(e) => {
                tracing::warn!("RabbitMQ connection attempt {attempt}/5 failed: {e}");
                if attempt == 5 {
                    return Err(e);
                }
                tokio::time::sleep(delay).await;
                delay *= 2;
            }
        }
    }
    unreachable!()
}

// Sets up the channel: declares exchanges and the ops-hub-all-queue,
// then binds the queue to all exchanges with wildcard routing keys.
async fn setup_channel(channel: &Channel) -> Result<(), lapin::Error> {
    let exchange_opts = ExchangeDeclareOptions {
        durable: true,
        ..Default::default()
    };

    for (exchange, _) in EXCHANGES {
        channel
            .exchange_declare(exchange, ExchangeKind::Topic, exchange_opts, FieldTable::default())
            .await?;
    }

    let queue_opts = QueueDeclareOptions {
        durable: true,
        ..Default::default()
    };
    channel
        .queue_declare(QUEUE_NAME, queue_opts, FieldTable::default())
        .await?;

    for (exchange, routing_key) in EXCHANGES {
        channel
            .queue_bind(
                QUEUE_NAME,
                exchange,
                routing_key,
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await?;
        tracing::info!("Bound {QUEUE_NAME} to {exchange} with {routing_key}");
    }

    channel.basic_qos(10, Default::default()).await?;
    Ok(())
}

// Starts the event consumer as a background task. Logs every received
// event into the event_log table and ACKs the message.
pub async fn start_consumer(rabbitmq_url: String, pool: Arc<PgPool>) {
    let conn = match connect_with_retry(&rabbitmq_url).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to connect to RabbitMQ after retries: {e}");
            return;
        }
    };

    let channel = match conn.create_channel().await {
        Ok(ch) => ch,
        Err(e) => {
            tracing::error!("Failed to create channel: {e}");
            return;
        }
    };

    if let Err(e) = setup_channel(&channel).await {
        tracing::error!("Failed to setup channel: {e}");
        return;
    }

    let consumer = match channel
        .basic_consume(
            QUEUE_NAME,
            "ops-hub-consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to start consuming: {e}");
            return;
        }
    };

    tracing::info!("Event consumer started on {QUEUE_NAME}");

    use futures_lite::StreamExt;
    let mut consumer = consumer;
    while let Some(delivery) = consumer.next().await {
        match delivery {
            Ok(delivery) => {
                let body = String::from_utf8_lossy(&delivery.data);

                // Parse the event payload as JSON
                match serde_json::from_str::<serde_json::Value>(&body) {
                    Ok(payload) => {
                        let event_type = payload
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let source = source_service_from_event_type(event_type);

                        // Insert into event_log
                        if let Err(e) = sqlx::query(
                            "INSERT INTO event_log (event_type, source_service, payload) VALUES ($1, $2, $3)",
                        )
                        .bind(event_type)
                        .bind(source)
                        .bind(&payload)
                        .execute(pool.as_ref())
                        .await
                        {
                            tracing::error!("Failed to log event {event_type}: {e}");
                        } else {
                            tracing::info!(
                                event_type = event_type,
                                source = source,
                                "Event logged"
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to parse event payload: {e}");
                    }
                }

                if let Err(e) = delivery.ack(BasicAckOptions::default()).await {
                    tracing::error!("Failed to ACK message: {e}");
                }
            }
            Err(e) => {
                tracing::error!("Consumer delivery error: {e}");
            }
        }
    }

    tracing::warn!("Event consumer stream ended");
}
