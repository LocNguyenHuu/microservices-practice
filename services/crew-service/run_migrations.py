# Startup script: runs Alembic migrations then starts uvicorn.
# Used as the Docker CMD to ensure the database schema is up to date
# before the application begins accepting requests.

import os
import subprocess
import sys


def main():
    print("Running database migrations...")
    result = subprocess.run(
        ["python", "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Migration failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    print(f"Migrations complete:\n{result.stdout}")

    port = os.getenv("PORT", "8000")
    print(f"Starting uvicorn on port {port}...")
    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", port],
    )


if __name__ == "__main__":
    main()
