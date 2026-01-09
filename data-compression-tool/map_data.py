import json
from datetime import datetime
import os
import urllib.request

def map_extreme_min(source, output_file):
    """
    Extremely minifies satellite data for high-performance Vite applications.
    - Uses arrays instead of objects (saves key repetition)
    - Truncates precision to 6 decimal places
    - Converts Epoch to Unix Timestamps
    - Removes all whitespace
    """
    if source.startswith('http'):
        print(f"Downloading data from {source}...")
        with urllib.request.urlopen(source) as response:
            data = json.loads(response.read().decode())
    else:
        if not os.path.exists(source):
            print(f"Error: {source} not found.")
            return

        with open(source, 'r') as f:
            data = json.load(f)

    minified = []
    for s in data:
        try:
            # Convert ISO Epoch to Unix Timestamp
            epoch_str = s.get("EPOCH", "")
            # Handle potential trailing Z or microseconds
            epoch_dt = datetime.fromisoformat(epoch_str.replace('Z', '+00:00'))
            timestamp = int(epoch_dt.timestamp())

            # Format: [id, name, timestamp, inclination, raan, eccentricity, arg_perigee, mean_anomaly, mean_motion, bstar]
            # Precision is balanced for visualization vs accuracy
            entry = [
                s.get("NORAD_CAT_ID"),
                s.get("OBJECT_NAME", "").strip(),
                timestamp,
                round(float(s.get("INCLINATION", 0)), 6),
                round(float(s.get("RA_OF_ASC_NODE", 0)), 6),
                round(float(s.get("ECCENTRICITY", 0)), 7),
                round(float(s.get("ARG_OF_PERICENTER", 0)), 6),
                round(float(s.get("MEAN_ANOMALY", 0)), 6),
                round(float(s.get("MEAN_MOTION", 0)), 8),
                round(float(s.get("BSTAR", 0)), 10)
            ]
            minified.append(entry)
        except Exception as e:
            continue

    # Write in compact mode (no spaces, no indentation)
    with open(output_file, 'w') as f:
        json.dump(minified, f, separators=(',', ':'))

    new_size = os.path.getsize(output_file) / 1024
    print(f"Success!")
    print(f"Minified size: {new_size:.2f} KB")

if __name__ == "__main__":
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json"
    # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "minified.json")
    
    map_extreme_min(url, output_path)
