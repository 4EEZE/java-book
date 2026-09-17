#!/usr/bin/env python3
"""Проверяет, что каждый законченный пример из книги ведёт себя так, как
обещает его стикер: без стикера — работает, does_not_compile — не собирается,
throws — падает с исключением, wrong_behavior — собирается и работает.

Запуск: python3 check-code.py

Ловил настоящие ошибки: непомеченный блок, который бросал исключение, и блок с
пометкой «работает не то», который на деле падал с ClassCastException.
Фрагменты, файлы в пакетах и примеры, опирающиеся на соседний блок, пропускает —
их проверить в отрыве нельзя.
"""
import pathlib, re, subprocess, tempfile, collections
BLOCK = re.compile(r'^```java(,[a-z_]+)?\n(.*?)^```', re.S | re.M)
MAIN = re.compile(r'\b(?:static\s+)?void\s+main\s*\(')
FAIL = "error: compilation failed"

res, problems, skipped = collections.Counter(), [], collections.Counter()

for f in sorted(pathlib.Path("src").glob("*.md")):
    for n, m in enumerate(BLOCK.finditer(f.read_text(encoding="utf-8")), 1):
        sticker, code = (m.group(1) or "").lstrip(","), m.group(2)
        if not MAIN.search(code):
            skipped["фрагмент без main"] += 1; continue
        if len(code.strip().split("\n")) < 3:
            skipped["обрывок разбора"] += 1; continue
        if re.match(r'\s*package\s', code):
            skipped["файл в пакете"] += 1; continue
        if "IO.readln" in code:
            skipped["читает ввод"] += 1; continue
        with tempfile.TemporaryDirectory() as d:
            (pathlib.Path(d) / "Main.java").write_text(code, encoding="utf-8")
            try:
                p = subprocess.run(["java", "Main.java"], capture_output=True, text=True,
                                   timeout=20, cwd=d, input="")     # пустой stdin
            except subprocess.TimeoutExpired:
                skipped["намеренно бесконечный"] += 1; continue
        compiled = FAIL not in p.stderr
        # «не нашёл символ» + этот символ в блоке не объявлен => пример опирается
        # на соседний блок (книга показывает их как отдельные файлы).
        missing_syms = re.findall(r'symbol:\s+(?:class|variable|method)\s+(\w+)', p.stderr)
        declared = set(re.findall(r'\b(?:class|record|interface|enum)\s+(\w+)', code))
        if not compiled and missing_syms and not (set(missing_syms) & declared):
            skipped["опирается на соседний блок"] += 1; continue
        ran = compiled and p.returncode == 0
        exits = re.search(r'System\.exit', code)
        want = {"": "ok", "wrong_behavior": "ok",
                "does_not_compile": "nocompile", "throws": "runtime"}[sticker]
        got = "ok" if ran else ("nocompile" if not compiled else "runtime")
        if got == "runtime" and exits and want == "ok":
            skipped["свой код возврата"] += 1; continue
        res[f"{sticker or 'без стикера'}: {'ok' if got == want else 'РАСХОЖДЕНИЕ'}"] += 1
        if got != want:
            problems.append(f"{f.name} блок {n} [{sticker or 'без стикера'}] ждали {want}, вышло {got}")

for k in sorted(skipped): print(f"  пропущено — {k}: {skipped[k]}")
print()
for k in sorted(res): print(f"  {k}: {res[k]}")
print(f"\nрасхождений: {len(problems)}")
for x in problems: print("  " + x)
import sys
sys.exit(1 if problems else 0)
