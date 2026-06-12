from enum import Enum


class UserRole(str, Enum):
    CITIZEN = "citizen"
    OFFICER = "officer"
    STATION_ADMIN = "station_admin"
    HIGHER_AUTHORITY = "higher_authority"


class FIRStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    UNDER_INVESTIGATION = "under_investigation"
    RESOLVED = "resolved"
    REJECTED = "rejected"
    CLOSED = "closed"
    ESCALATED = "escalated"


class EscalationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    RESOLVED = "resolved"
    REDIRECTED = "redirected"


class IncidentType(str, Enum):
    THEFT = "theft"
    ASSAULT = "assault"
    MISSING_PERSON = "missing_person"
    SEXUAL_ASSAULT = "sexual_assault"
    HIT_AND_RUN = "hit_and_run"
    FRAUD = "fraud"
    CYBER_CRIME = "cyber_crime"
    PROPERTY_DAMAGE = "property_damage"
    DOMESTIC_VIOLENCE = "domestic_violence"
    OTHER = "other"
