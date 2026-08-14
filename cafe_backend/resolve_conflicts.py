import re, pathlib

pattern = re.compile(
    r"<<<<<<< HEAD\r?\n.*?=======\r?\n(.*?)>>>>>>> [0-9a-fA-F]+\r?\n",
    re.DOTALL,
)

for fname in ["owner.py", "main.py"]:
    p = pathlib.Path(fname)
    text = p.read_text(encoding="utf-8")
    new_text, n = pattern.subn(r"\1", text)
    print(fname, "resolved", n, "conflicts")
    p.write_text(new_text, encoding="utf-8")
