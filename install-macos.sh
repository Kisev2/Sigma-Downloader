#!/bin/bash
set -e

echo "starting..."

d1="$(cd "$(dirname "$0")" && pwd)"

for i in {3..13}; do
  defaults write "com.adobe.CSXS.$i" PlayerDebugMode 1 2>/dev/null || true
done

f1=""

while IFS= read -r m1; do
  p1="$(dirname "$m1")"
  if [[ "$p1" == *"/CSXS" ]]; then
    if [[ "$p1" == "$d1"* ]]; then
      f1="$(dirname "$p1")"
      break
    fi
  fi
done < <(find "$d1" -name "manifest.xml" 2>/dev/null)

if [ -z "$f1" ]; then
  echo "not found"
  exit 1
fi

n1="$(basename "$f1")"

t1="$HOME/Library/Application Support/Adobe/CEP/extensions/$n1"

echo "copying..."

mkdir -p "$t1"
cp -R "$f1/" "$t1/"

echo "done"