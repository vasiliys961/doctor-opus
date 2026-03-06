# Deploy Rules

## Branch Mapping

- `doctor-opus.ru` (RU) -> repo path `/home/doctor-opus` -> branch `main`
- `doctor-opus.online` (EN) -> repo path `/home/doctor-opus-en` -> branch `en-version-global`
- Do not mix RU/EN paths, branches, remotes, or compose commands.

## Pre-Deploy Check

```bash
cd /home/doctor-opus && git branch --show-current
cd /home/doctor-opus-en && git branch --show-current
```

Expected output:
- RU: `main`
- EN: `en-version-global`

## Fast Commit Verification On Server

```bash
for d in /home/doctor-opus /home/doctor-opus-en; do
  echo "== $d =="
  cd "$d" || continue
  b=$(git branch --show-current)
  h=$(git rev-parse --short HEAD)
  git fetch origin "$b" -q || true
  r=$(git rev-parse --short "origin/$b" 2>/dev/null || echo n/a)
  echo "branch=$b head=$h origin/$b=$r"
  git status -sb
  echo
done
```

## Safety Notes

- Do not push/force-push from server unless explicitly required.
- If branch mapping looks wrong, stop deploy and fix remotes first.
- If one domain is up and the second fails, do not restart everything at once; isolate RU/EN checks.
