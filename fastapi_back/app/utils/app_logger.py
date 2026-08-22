"""Structured logging — never log secrets, tokens, or database URLs."""
import logging
import re
import sys

_REDACT_PATTERNS = [
    (re.compile(r"(postgresql|mysql|mongodb)(\+srv)?://[^\s\"']+", re.I), r"\1://[REDACTED]"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._\-]+", re.I), r"\1[REDACTED]"),
    (re.compile(r"(api[_-]?key|secret|password|token)\s*[=:]\s*['\"]?[^'\"\s,}]+", re.I), r"\1=[REDACTED]"),
]


def _redact(message: str) -> str:
    out = message
    for pattern, repl in _REDACT_PATTERNS:
        out = pattern.sub(repl, out)
    return out


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        if isinstance(record.msg, str):
            record.msg = _redact(record.msg)
        if record.args:
            record.args = tuple(
                _redact(a) if isinstance(a, str) else a for a in record.args
            )
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    
    # Add File Handler for debugging
    has_file_handler = any(isinstance(h, logging.FileHandler) for h in logger.handlers)
    if not has_file_handler:
        try:
            file_handler = logging.FileHandler(r"c:\Users\Hanuman\Desktop\SHAMS-main\medclues_debug.log", encoding="utf-8")
            file_handler.setFormatter(
                RedactingFormatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
            )
            logger.addHandler(file_handler)
        except Exception:
            pass

    has_stream_handler = any(isinstance(h, logging.StreamHandler) for h in logger.handlers)
    if not has_stream_handler:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            RedactingFormatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
        logger.addHandler(handler)
        
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger
