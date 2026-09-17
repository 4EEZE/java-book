#!/usr/bin/env python3
"""Проверка квизов по выводам исследования Crichton & Krishnamurthi (OOPSLA 2024).

Запуск: python3 check-quizzes.py

Проверяет три вещи:
  1. Нет вопросов формата «скомпилируется ли?» — статья показала, что они
     наименее дискриминативны (6 из 20 худших, 0 из 20 лучших).
  2. Всё, о чём спрашивает вопрос, проговорено в тексте раздела. В статье самые
     результативные правки были именно там, где вопрос проверял подразумеваемое.
  3. Вопросы короткие: медиана времени на ответ у читателей — 29 секунд.
"""
import collections, pathlib, re, statistics, sys, tomllib

TOKEN = re.compile(r"`([A-Za-z_][\w.]*(?:\(\))?)`")
# Базовые слова языка и то, что вопрос определяет сам, проговаривать не нужно.
STOP = {"java", "javac", "int", "String", "void", "main", "true", "false", "null"}
DEFINED = re.compile(r"\b(?:class|interface|record|enum)\s+(\w+)|(\w+)\s*\(")

def section_for(quiz: pathlib.Path) -> pathlib.Path:
    # ch08-00-collections-sec1.toml -> src/ch08-00-collections.md
    return pathlib.Path("src") / (re.sub(r"-sec\d+$", "", quiz.stem) + ".md")

problems, kinds, lengths = [], collections.Counter(), []

for quiz in sorted(pathlib.Path("quizzes").glob("*.toml")):
    text = section_for(quiz).read_text(encoding="utf-8")
    for i, q in enumerate(tomllib.load(open(quiz, "rb"))["questions"], 1):
        where = f"{quiz.stem}#{i}"
        prompt, answer = q["prompt"], q["answer"]
        kinds[q["type"]] += 1

        if q["type"] == "Tracing" and not answer["doesCompile"]:
            problems.append(f"{where}: формат «не компилируется» — спросите ПОЧЕМУ")

        program = prompt.get("program", "") or ""
        body = prompt.get("prompt", "") or ""
        lengths.append(len(body) + len(program)
                       + sum(len(d) for d in prompt.get("distractors") or []))

        # Идентификаторы, объявленные в самом вопросе, тексту знать неоткуда.
        own = {m for pair in DEFINED.findall(program + body) for m in pair if m}
        said = (answer.get("answer") or "") + " " + (q.get("context") or "")
        missing = sorted(
            t for t in {x for x in TOKEN.findall(said) if x not in STOP and len(x) > 2}
            if t.rstrip("()") not in own
            and t not in text and t.rstrip("()") not in text
        )
        if missing:
            problems.append(f"{where}: не проговорено в тексте — {', '.join(missing)}")

for p in problems:
    print("  " + p)
print(f"вопросов: {sum(kinds.values())} — {dict(kinds)}")
print(f"медиана длины: {statistics.median(lengths):.0f} символов, "
      f"длиннее 700: {sum(1 for n in lengths if n > 700)}")
print("ошибок нет" if not problems else f"ОШИБОК: {len(problems)}")
sys.exit(1 if problems else 0)
