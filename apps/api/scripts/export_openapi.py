import argparse
import json
from pathlib import Path

from inorganic_api.main import app


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the canonical FastAPI OpenAPI document.")
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        f"{json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
