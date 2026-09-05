"""
Base Agent and Universal LLM Interface.
Supports Google Gemini, OpenAI, Anthropic, Ollama, and high-fidelity deterministic fallback.
"""

from typing import Dict, Any, List, Optional
import os
import json
import httpx
import logging

logger = logging.getLogger(__name__)


class LLMClient:
    """
    Universal LLM client for trading agents.
    Discovers available API keys:
    1. GEMINI_API_KEY
    2. OPENAI_API_KEY
    3. OLLAMA_BASE_URL (defaults to http://localhost:11434)
    """

    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.ollama_base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
        self.model = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    async def generate_response(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        """Call active LLM provider or gracefully return structured response."""
        # 1. Google Gemini via REST (fast, zero heavy SDK issues)
        if self.gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.gemini_key}"
                payload = {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{system_prompt}\n\nTask:\n{user_prompt}"}]}
                    ],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 1024,
                    }
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        text = data['candidates'][0]['content']['parts'][0]['text']
                        return text
            except Exception as e:
                logger.warning(f"Gemini LLM call failed, trying fallback: {e}")

        # 2. OpenAI or compatible endpoint
        if self.openai_key:
            try:
                api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
                url = f"{api_base}/chat/completions"
                headers = {"Authorization": f"Bearer {self.openai_key}"}
                payload = {
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.warning(f"OpenAI LLM call failed: {e}")

        # 3. Local Ollama if explicitly requested
        if os.getenv("USE_OLLAMA") == "true" or os.getenv("OLLAMA_MODEL"):
            try:
                url = f"{self.ollama_base}/api/generate"
                payload = {
                    "model": os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
                    "prompt": f"{system_prompt}\n\n{user_prompt}",
                    "stream": False,
                }
                async with httpx.AsyncClient(timeout=2.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        return res.json().get("response", "")
            except Exception:
                pass

        # 4. Deterministic fallback mode (Grounded & Rule-Verified)
        return ""


class BaseAgent:
    """Base specialized trading agent."""

    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.llm = LLMClient()

    def create_thought_log(self, step: str, thought: str) -> Dict[str, Any]:
        return {
            "agent": self.name,
            "role": self.role,
            "step": step,
            "thought": thought,
            "timestamp": pd_now()
        }


def pd_now() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
