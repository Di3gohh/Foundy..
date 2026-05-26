import math
import secrets


def validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude < -90 or latitude > 90:
        raise ValueError("Latitude inválida.")
    if longitude < -180 or longitude > 180:
        raise ValueError("Longitude inválida.")


def mask_coordinates(latitude: float, longitude: float, radius_meters: int = 500) -> tuple[float, float]:
    validate_coordinates(latitude, longitude)

    angle = (secrets.randbelow(10_000_000) / 10_000_000) * 2 * math.pi
    distance = radius_meters * math.sqrt(secrets.randbelow(10_000_000) / 10_000_000)

    meters_per_degree_lat = 111_320
    meters_per_degree_lng = max(1.0, 111_320 * math.cos(math.radians(latitude)))

    masked_latitude = latitude + (distance * math.cos(angle)) / meters_per_degree_lat
    masked_longitude = longitude + (distance * math.sin(angle)) / meters_per_degree_lng

    return masked_latitude, masked_longitude
