"""Module 2 — Intent Dictionary tests."""
from __future__ import annotations

import copy
from pathlib import Path

import pytest
import yaml

from app.services.ai.intent import detect_intents
from app.services.ai.intent.dictionary import (
    IntentDictionaryValidationError,
    get_dictionary,
    get_intent,
    load_dictionary,
    reload,
    validate_dictionary,
)
from app.services.ai.intent.dictionary.intent_loader import default_path
from app.services.ai.intent.dictionary.intent_schema import IntentDefinition, IntentDictionary
from app.services.ai.intent.matcher import rebuild_rules, rules_source


@pytest.fixture(autouse=True)
def _reload_dictionary():
    """Keep engine on the real dictionary between tests."""
    reload()
    yield
    reload()


def test_dictionary_loads_successfully():
    dictionary = get_dictionary(force_reload=True, raise_on_error=True)
    assert dictionary.version >= 1
    assert len(dictionary.intents) >= 40
    assert "unknown_intent" in dictionary.intents
    assert rules_source() == "dictionary"


def test_lookup_book_appointment():
    intent = get_intent("book_appointment")
    assert intent is not None
    assert intent.id == "book_appointment"
    assert intent.category == "Appointment"
    assert intent.priority >= 80
    assert intent.tool == "search_doctors"
    assert intent.requires_confirmation is True
    assert len(intent.examples) >= 20


def test_synonym_presence_search_medicine():
    intent = get_intent("search_medicine")
    assert intent is not None
    syns = {s.lower() for s in intent.synonyms}
    assert "search medicine" in syns or "find medicine" in syns
    assert "need medicine" in syns


def test_emergency_priority_metadata():
    emergency = get_intent("emergency_help")
    assert emergency is not None
    assert emergency.emergency is True
    assert emergency.priority == 100
    assert emergency.output_category == "emergency"
    assert emergency.message_type == "emergency"

    unknown = get_intent("unknown_intent")
    assert unknown is not None
    assert unknown.priority == 0


def test_duplicate_id_fails_validation(tmp_path: Path):
    raw = yaml.safe_load(default_path().read_text(encoding="utf-8"))
    intents = list(raw["intents"])
    dup = copy.deepcopy(intents[0])
    intents.append(dup)
    raw["intents"] = intents
    bad = tmp_path / "dup.yaml"
    bad.write_text(yaml.dump(raw), encoding="utf-8")
    with pytest.raises(IntentDictionaryValidationError) as exc:
        load_dictionary(bad, validate=True)
    assert any("duplicate intent id" in e for e in exc.value.result.errors)


def test_invalid_confidence_fails_validation():
    intent = get_intent("book_appointment")
    assert intent is not None
    bad = IntentDefinition(
        id="book_appointment",
        name=intent.name,
        description=intent.description,
        category=intent.category,
        priority=intent.priority,
        confidence_threshold=1.5,
        synonyms=intent.synonyms,
        aliases=intent.aliases,
        examples=intent.examples,
        workflow=intent.workflow,
        required_entities=intent.required_entities,
        tool=intent.tool,
        requires_auth=intent.requires_auth,
        requires_confirmation=intent.requires_confirmation,
        supports_followup=intent.supports_followup,
        emergency=intent.emergency,
        fallback_intent="unknown_intent",
        output_category=intent.output_category,
        message_type=intent.message_type,
        patterns=intent.patterns,
    )
    dictionary = IntentDictionary(
        version=1,
        intents={
            "book_appointment": bad,
            "unknown_intent": get_intent("unknown_intent"),
        },
    )
    with pytest.raises(IntentDictionaryValidationError) as exc:
        validate_dictionary(dictionary, raise_on_error=True)
    assert any("confidence_threshold" in e for e in exc.value.result.errors)


def test_unknown_intent_entry_exists():
    intent = get_intent("unknown_intent")
    assert intent is not None
    assert intent.category == "Unknown"
    assert intent.tool == "knowledge_search"


def test_engine_detects_core_intents_after_dict_matcher():
    assert rebuild_rules() == "dictionary"

    book = detect_intents("book an appointment with a doctor")
    assert book.primary_intent == "book_appointment"

    cancel = detect_intents("cancel my appointment")
    assert cancel.primary_intent == "cancel_appointment"

    greet = detect_intents("hello")
    assert greet.primary_intent == "greeting"

    emergency = detect_intents("I have chest pain emergency")
    assert emergency.primary_intent in {
        "emergency_help",
        "ambulance",
        "nearest_emergency_hospital",
    }


def test_yaml_only_synonym_recognized_after_reload(tmp_path: Path):
    raw = yaml.safe_load(default_path().read_text(encoding="utf-8"))
    for item in raw["intents"]:
        if item["id"] == "book_appointment":
            item.setdefault("synonyms", []).append("medclues schedule visit now")
            break
    else:
        pytest.fail("book_appointment missing")

    path = tmp_path / "intent_dictionary.yaml"
    path.write_text(yaml.dump(raw, sort_keys=False), encoding="utf-8")
    reload(path)

    result = detect_intents("medclues schedule visit now")
    assert result.primary_intent == "book_appointment"
