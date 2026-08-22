from pathlib import Path

base = Path(__file__).resolve().parents[1] / "src" / "pages" / "Reception"
repls = [
    (
        "tab === t.id ? 'bg-rd-primary text-white' : 'bg-rd-surface text-rd-muted border border-rd-border hover:bg-rd-canvas'",
        "tab === t.id ? 'rd-tab-active' : 'rd-tab-idle'",
    ),
    (
        "? 'bg-rd-primary text-white'",
        "? 'rd-tab-active'",
    ),
    (
        ": 'bg-rd-surface text-rd-muted border border-rd-border hover:bg-rd-canvas'",
        ": 'rd-tab-idle'",
    ),
    (
        ": 'bg-rd-surface border border-rd-border text-rd-muted hover:bg-rd-canvas'",
        ": 'rd-tab-idle'",
    ),
]

for p in base.glob("*.jsx"):
    t = p.read_text(encoding="utf-8")
    n = t
    for a, b in repls:
        n = n.replace(a, b)
    if n != t:
        p.write_text(n, encoding="utf-8")
        print("updated", p.name)
