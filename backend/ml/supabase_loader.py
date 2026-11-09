"""
Supabase Data Loader

Fetches real daily_logs from Supabase using direct REST API calls
(uses requests instead of supabase-py to avoid DNS/async issues on Windows).
"""

import os
import requests
from typing import List, Dict, Tuple

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def get_headers():
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def fetch_training_data() -> Tuple[List[Dict], List[int], List[float]]:
    """
    Pull all daily_logs rows from Supabase and convert them into
    (daily_logs, risk_levels, risk_percentages) for model training.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "")
    headers = get_headers()
    if not supabase_url or not headers.get("apikey"):
        print("[ML] Supabase credentials missing from environment.")
        return [], [], []

    try:
        url = f"{supabase_url}/rest/v1/daily_logs"
        params = {
            "select": "screen_time,breaks_taken,eye_strain,headaches,"
                      "blurry_vision,dry_eyes,brightness,sleep_hours,"
                      "risk_level,eye_strain_frequency,headaches_frequency,"
                      "blurry_vision_frequency,dry_eyes_frequency",
            "limit": "10000"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=15)

        if resp.status_code != 200:
            print(f"[ML] Supabase fetch failed: {resp.status_code} {resp.text[:100]}")
            return [], [], []

        rows = resp.json() or []
        if not rows:
            print("[ML] No rows found in daily_logs table")
            return [], [], []

        print(f"[ML] Fetched {len(rows)} rows from Supabase for training")

        risk_label_map = {
            "low": 0, "moderate": 1, "high": 2,
            "critical": 3, "severe": 3, "medium": 1,
        }

        daily_logs, risk_levels, risk_percentages = [], [], []

        for row in rows:
            symptoms = []
            if row.get("eye_strain"):     symptoms.append("moderate_eye_strain")
            if row.get("headaches"):      symptoms.append("headache")
            if row.get("blurry_vision"):  symptoms.append("blurred_vision")
            if row.get("dry_eyes"):       symptoms.append("dry_eyes")

            log = {
                "screen_time_hours": float(row.get("screen_time") or 0),
                "break_minutes": float(row.get("breaks_taken") or 0) * 5,
                "symptoms": symptoms,
                "sleep_quality": float(row.get("sleep_hours") or 7),
                "water_intake_cups": 6,
                "break_type": "rest",
                "eye_exercises": 0,
                "blue_light_filter": False,
                "brightness": float(row.get("brightness") or 70),
            }

            raw_risk = (row.get("risk_level") or "moderate").lower()
            risk_level_int = risk_label_map.get(raw_risk, 1)

            screen_time = log["screen_time_hours"]
            base_pct = risk_level_int * 25.0
            screen_bonus = min(screen_time / 12 * 20, 20)
            symptom_bonus = len(symptoms) * 3.0
            risk_pct = min(100.0, base_pct + screen_bonus + symptom_bonus)

            daily_logs.append(log)
            risk_levels.append(risk_level_int)
            risk_percentages.append(risk_pct)

        return daily_logs, risk_levels, risk_percentages

    except Exception as e:
        print(f"[ML] Error fetching training data from Supabase: {e}")
        return [], [], []


def count_training_rows() -> int:
    """Return the number of rows available in daily_logs for training."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    headers = get_headers()
    if not supabase_url or not headers.get("apikey"):
        return 0

    try:
        url = f"{supabase_url}/rest/v1/daily_logs"
        params = {"select": "id", "limit": "1"}
        req_headers = {**headers, "Prefer": "count=exact"}
        resp = requests.get(url, headers=req_headers, params=params, timeout=10)
        count = resp.headers.get("content-range", "0/0").split("/")[-1]
        return int(count) if count.isdigit() else 0
    except Exception as e:
        print(f"[ML] Error counting training rows: {e}")
        return 0
