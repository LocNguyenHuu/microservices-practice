// Periodic scheduler jobs for proactive operational monitoring.
// Three jobs run on staggered intervals to detect delays, stuck tasks, and crew shortages.
// All jobs are tolerant of HTTP/parsing errors — they log and continue on the next cycle.

use chrono::Utc;
use sqlx::PgPool;
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::config::Config;

// Turnaround response shape from GET /api/turnarounds?status=in_progress
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Turnaround {
    #[serde(alias = "_id")]
    id: Option<String>,
    flight_id: Option<String>,
    flight_number: Option<String>,
    status: Option<String>,
    started_at: Option<String>,
    progress_percent: Option<f64>,
    tasks: Option<Vec<TurnaroundTask>>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct TurnaroundTask {
    #[serde(alias = "_id")]
    id: Option<String>,
    name: Option<String>,
    status: Option<String>,
    estimated_duration_minutes: Option<f64>,
    started_at: Option<String>,
}

// Flight response shape from GET /api/flights/arrivals/upcoming
#[derive(Debug, serde::Deserialize)]
struct Flight {
    id: Option<String>,
    flight_number: Option<String>,
    aircraft_type: Option<String>,
}

// Available crew response shape from GET /api/crew/available
#[derive(Debug, serde::Deserialize)]
struct CrewMember {
    id: Option<String>,
}

pub async fn start_scheduler(config: Config, pool: Arc<PgPool>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let sched = JobScheduler::new().await?;
    let client = Arc::new(reqwest::Client::new());

    // Job 1: Turnaround Delay Detector — every 2 minutes
    let pool1 = pool.clone();
    let config1 = config.clone();
    let client1 = client.clone();
    let delay_job = Job::new_async("0 */2 * * * *", move |_uuid, _lock| {
        let pool = pool1.clone();
        let config = config1.clone();
        let client = client1.clone();
        Box::pin(async move {
            if let Err(e) = check_turnaround_delays(&client, &config, &pool).await {
                tracing::error!("Delay detection job failed: {e}");
            }
        })
    })?;
    sched.add(delay_job).await?;

    // Job 2: Stuck Task Scanner — every 3 minutes
    let pool2 = pool.clone();
    let config2 = config.clone();
    let client2 = client.clone();
    let stuck_job = Job::new_async("0 */3 * * * *", move |_uuid, _lock| {
        let pool = pool2.clone();
        let config = config2.clone();
        let client = client2.clone();
        Box::pin(async move {
            if let Err(e) = check_stuck_tasks(&client, &config, &pool).await {
                tracing::error!("Stuck task scanner failed: {e}");
            }
        })
    })?;
    sched.add(stuck_job).await?;

    // Job 3: Crew Shortage Pre-check — every 5 minutes
    let pool3 = pool.clone();
    let config3 = config.clone();
    let client3 = client.clone();
    let crew_job = Job::new_async("0 */5 * * * *", move |_uuid, _lock| {
        let pool = pool3.clone();
        let config = config3.clone();
        let client = client3.clone();
        Box::pin(async move {
            if let Err(e) = check_crew_shortage(&client, &config, &pool).await {
                tracing::error!("Crew shortage check failed: {e}");
            }
        })
    })?;
    sched.add(crew_job).await?;

    sched.start().await?;
    tracing::info!("Scheduler started: delay(2m), stuck(3m), crew(5m)");
    Ok(())
}

// Checks for delayed turnarounds: progress < 50% when > 75% of estimated time has elapsed.
async fn check_turnaround_delays(
    client: &reqwest::Client,
    config: &Config,
    pool: &PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!(
        "{}/api/turnarounds?status=in_progress&limit=100",
        config.turnaround_service_url
    );
    let turnarounds: Vec<Turnaround> = client.get(&url).send().await?.json().await?;

    let now = Utc::now();
    for ta in &turnarounds {
        let progress = ta.progress_percent.unwrap_or(0.0);
        let tasks = ta.tasks.as_deref().unwrap_or(&[]);
        let total_estimated_min: f64 = tasks
            .iter()
            .filter_map(|t| t.estimated_duration_minutes)
            .sum();

        if total_estimated_min <= 0.0 {
            continue;
        }

        // Calculate elapsed time since turnaround started
        let started_at = match &ta.started_at {
            Some(s) => match chrono::DateTime::parse_from_rfc3339(s) {
                Ok(dt) => dt.with_timezone(&Utc),
                Err(_) => continue,
            },
            None => continue,
        };
        let elapsed_min = (now - started_at).num_minutes() as f64;
        let elapsed_ratio = elapsed_min / total_estimated_min;

        // Alert if progress < 50% but > 75% of time has passed
        if progress < 50.0 && elapsed_ratio > 0.75 {
            let ta_id = ta.id.as_deref().unwrap_or("unknown");

            // Dedup: skip if open alert already exists
            let existing: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM alerts WHERE turnaround_id = $1 AND alert_type = 'turnaround_delayed' AND status = 'open'"
            )
            .bind(ta_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

            if existing == 0 {
                let title = format!(
                    "Turnaround delayed: {} ({}% at {:.0}% elapsed)",
                    ta.flight_number.as_deref().unwrap_or("?"),
                    progress,
                    elapsed_ratio * 100.0
                );
                // Use text cast for MongoDB ObjectId turnaround_id
                let _ = sqlx::query(
                    "INSERT INTO alerts (alert_type, severity, turnaround_id, title, description) VALUES ('turnaround_delayed', 'warning', $1, $2, $3)"
                )
                .bind(ta_id)
                .bind(&title)
                .bind(format!("Progress {progress}% with {elapsed_ratio:.0}% time elapsed"))
                .execute(pool)
                .await;

                tracing::warn!(turnaround_id = ta_id, "Turnaround delayed alert created");
            }
        }
    }

    tracing::debug!("Delay detection checked {} turnarounds", turnarounds.len());
    Ok(())
}

// Checks for tasks stuck in_progress longer than 1.5x their estimated duration.
async fn check_stuck_tasks(
    client: &reqwest::Client,
    config: &Config,
    pool: &PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!(
        "{}/api/turnarounds?status=in_progress&limit=100",
        config.turnaround_service_url
    );
    let turnarounds: Vec<Turnaround> = client.get(&url).send().await?.json().await?;

    let now = Utc::now();
    for ta in &turnarounds {
        let ta_id = ta.id.as_deref().unwrap_or("unknown");
        let tasks = ta.tasks.as_deref().unwrap_or(&[]);

        for task in tasks {
            if task.status.as_deref() != Some("in_progress") {
                continue;
            }

            let estimated = task.estimated_duration_minutes.unwrap_or(0.0);
            let started_at = match &task.started_at {
                Some(s) => match chrono::DateTime::parse_from_rfc3339(s) {
                    Ok(dt) => dt.with_timezone(&Utc),
                    Err(_) => continue,
                },
                None => continue,
            };

            let elapsed_min = (now - started_at).num_minutes() as f64;
            if elapsed_min > estimated * 1.5 && estimated > 0.0 {
                let task_name = task.name.as_deref().unwrap_or("unknown");

                // Dedup by turnaround_id + task name
                let existing: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM alerts WHERE turnaround_id = $1 AND alert_type = 'task_stuck' AND status = 'open' AND description LIKE $2"
                )
                .bind(ta_id)
                .bind(format!("%{task_name}%"))
                .fetch_one(pool)
                .await
                .unwrap_or(0);

                if existing == 0 {
                    let title = format!(
                        "Task stuck: {} in turnaround {}",
                        task_name,
                        ta.flight_number.as_deref().unwrap_or("?")
                    );
                    let _ = sqlx::query(
                        "INSERT INTO alerts (alert_type, severity, turnaround_id, title, description) VALUES ('task_stuck', 'warning', $1, $2, $3)"
                    )
                    .bind(ta_id)
                    .bind(&title)
                    .bind(format!("Task {task_name} running {elapsed_min:.0}min (estimated {estimated:.0}min)"))
                    .execute(pool)
                    .await;

                    tracing::warn!(turnaround_id = ta_id, task = task_name, "Stuck task alert created");
                }
            }
        }
    }

    tracing::debug!("Stuck task scanner checked {} turnarounds", turnarounds.len());
    Ok(())
}

// Checks upcoming arrivals for crew availability.
// Queries the flight service for arrivals within 30 minutes, then checks if
// critical certifications (fueling, cargo, catering) have available crew.
async fn check_crew_shortage(
    client: &reqwest::Client,
    config: &Config,
    pool: &PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!(
        "{}/api/flights/arrivals/upcoming?within=30m",
        config.flight_service_url
    );
    let flights: Vec<Flight> = match client.get(&url).send().await {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(e) => {
            tracing::debug!("No upcoming arrivals or flight service unavailable: {e}");
            return Ok(());
        }
    };

    let critical_certs = ["fueling", "cargo", "catering"];

    for flight in &flights {
        let flight_id = flight.id.as_deref().unwrap_or("unknown");

        for cert in &critical_certs {
            let crew_url = format!(
                "{}/api/crew/available?certification={}",
                config.crew_service_url, cert
            );
            let available: Vec<CrewMember> = match client.get(&crew_url).send().await {
                Ok(resp) => resp.json().await.unwrap_or_default(),
                Err(_) => vec![],
            };

            if available.is_empty() {
                // Dedup by flight_id + cert type
                let existing: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM alerts WHERE flight_id = $1 AND alert_type = 'crew_shortage' AND status = 'open' AND description LIKE $2"
                )
                .bind(flight_id)
                .bind(format!("%{cert}%"))
                .fetch_one(pool)
                .await
                .unwrap_or(0);

                if existing == 0 {
                    let title = format!(
                        "Crew shortage: no {} crew for {}",
                        cert,
                        flight.flight_number.as_deref().unwrap_or("?")
                    );
                    let _ = sqlx::query(
                        "INSERT INTO alerts (alert_type, severity, flight_id, title, description) VALUES ('crew_shortage', 'critical', $1, $2, $3)"
                    )
                    .bind(flight_id)
                    .bind(&title)
                    .bind(format!("No available crew with {cert} certification for upcoming arrival"))
                    .execute(pool)
                    .await;

                    tracing::warn!(flight_id = flight_id, cert = cert, "Crew shortage alert created");
                }
            }
        }
    }

    tracing::debug!("Crew shortage check for {} upcoming flights", flights.len());
    Ok(())
}
