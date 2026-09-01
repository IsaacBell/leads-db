"""Processors in the lead enrichment pipeline.

Each processor ingests data at a different stage, runs its logic, and writes results
back to the database. Processors share the EnrichmentProcessor base class for
startup/shutdown boilerplate but each has a distinct responsibility.

Available processors:
    certstream_ingestor  — CertstreamIngestor:  WebSocket → raw domains
    domain_enricher      — DomainEnricher:      DNS/HTTP → enriched signals
    entity_scorer        — EntityScorer:        LLM → business entity scoring
    lead_promoter        — LeadPromoter:        scored → CRM promotion
"""

from leadsdb_engine.processors.base import EnrichmentProcessor
from leadsdb_engine.processors.certstream_ingestor import CertstreamIngestor
from leadsdb_engine.processors.domain_enricher import DomainEnricher
from leadsdb_engine.processors.entity_scorer import EntityScorer
from leadsdb_engine.processors.lead_promoter import LeadPromoter

__all__ = [
    "EnrichmentProcessor",
    "CertstreamIngestor",
    "DomainEnricher",
    "EntityScorer",
    "LeadPromoter",
]
