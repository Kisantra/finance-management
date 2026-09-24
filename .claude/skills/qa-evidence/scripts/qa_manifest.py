"""Shared manifest loading + markdown-ish text helpers for the QA report scripts."""

import json
import re
from pathlib import Path


class Manifest:
    def __init__(self, path: str | Path):
        self.path = Path(path).resolve()
        self.data = json.loads(self.path.read_text(encoding='utf-8'))
        self.base = self.path.parent

    def __getitem__(self, key):
        return self.data[key]

    def get(self, key, default=None):
        return self.data.get(key, default)

    def rel(self, key, default=None) -> Path | None:
        """Resolve a path field relative to the manifest's own location."""
        value = self.data.get(key, default)
        return (self.base / value).resolve() if value else None

    @property
    def cases(self) -> list[dict]:
        """Only real cases, skipping section header entries."""
        return [c for c in self.data.get('cases', []) if 'id' in c]

    def scoreboard(self) -> dict[str, int]:
        """Counts derived from the manifest -- never hand-written.

        A case counts as executed when it has an attempt history. 'f' anywhere
        means an application defect was hit; a case whose history ends in 'p'
        eventually passed.
        """
        cases = self.cases
        executed = [c for c in cases if c.get('attempts')]
        passed = [c for c in executed if c['attempts'].endswith('p')]
        failed_first = [c for c in executed if c['attempts'].startswith('f')]
        return {
            'total': len(cases),
            'executed': len(executed),
            'not_run': len(cases) - len(executed),
            'passed': len(passed),
            'failed_first': len(failed_first),
            'bugs': len(self.data.get('bugs', [])),
        }


def to_para(text: str) -> str:
    """Markdown subset -> reportlab inline markup."""
    text = text.replace('&', '&amp;')
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'`(.+?)`', r'<font face="Courier">\1</font>', text)
    return text.replace('—', '&mdash;').replace('→', '&rarr;')
