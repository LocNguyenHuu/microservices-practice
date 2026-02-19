// Environment-based configuration for the Ops Hub Service.
// Reads from environment variables with sensible defaults for local development.

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub rabbitmq_url: String,
    pub server_port: u16,
    pub flight_service_url: String,
    pub turnaround_service_url: String,
    pub crew_service_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/ops_db".into()),
            rabbitmq_url: std::env::var("RABBITMQ_URL")
                .unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/%2f".into()),
            server_port: std::env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8001),
            flight_service_url: std::env::var("FLIGHT_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            turnaround_service_url: std::env::var("TURNAROUND_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            crew_service_url: std::env::var("CREW_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8000".into()),
        }
    }
}
