# Cohere NLU — Render / ops ship note

Backend-only. Never put `COHERE_API_KEY` in Flutter or commit it.

```
AI_ASSISTANT_ENABLED=true
AI_LLM_ENABLED=true
AI_LLM_PROVIDER=cohere
AI_LLM_MODEL=command-r-plus
COHERE_API_KEY=***rotated***
AI_NLU_PIPELINE_CUTOVER=true
```

If a key was pasted in chat, **rotate it** in the Cohere console before setting Render.

Optional: keep `AI_NLU_PIPELINE_CUTOVER=false` first (shadow), then enable after golden NL tests.

Verify: `GET /api/ai/assistant/status` → `features.llmProvider: "cohere"`.
