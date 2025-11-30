import json
import os
from typing import Optional
from functools import lru_cache


@lru_cache()
def _load_districts_data() -> dict:
    """Load and cache district data from JSON file."""
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "districts.json"
    )
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_all_districts() -> list[dict]:
    """Get all district information."""
    data = _load_districts_data()
    return data["districts"]


def get_valid_districts() -> list[str]:
    """Get list of valid district names."""
    data = _load_districts_data()
    return [d["name"] for d in data["districts"]]


def get_district_by_name(name: str) -> Optional[dict]:
    """Get district info by name (case-insensitive)."""
    data = _load_districts_data()
    for district in data["districts"]:
        if district["name"].lower() == name.lower():
            return district
    return None


def get_bounding_box() -> dict:
    """Get Sri Lanka bounding box coordinates."""
    data = _load_districts_data()
    return data["bounding_box"]
