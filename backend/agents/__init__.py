"""
Maintenance Wizard — Agent Registry
─────────────────────────────────────
Six specialised agents, each in its own module.
Import from here for clean usage throughout the routers.

Usage:
    from agents import diagnostic_agent, risk_scoring_agent
    result = await diagnostic_agent.run(query="...", equipment_id="RM-04")
"""

from agents import (
    diagnostic_agent,
    recommendation_agent,
    risk_scoring_agent,
    anomaly_detection_agent,
    report_agent,
    conversational_agent,
)

__all__ = [
    "diagnostic_agent",
    "recommendation_agent",
    "risk_scoring_agent",
    "anomaly_detection_agent",
    "report_agent",
    "conversational_agent",
]
