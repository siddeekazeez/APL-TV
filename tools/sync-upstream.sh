#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tag=$(gh api repos/Knikt/APL-TV/releases/latest --jq .tag_name)
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Unexpected upstream release tag' >&2; exit 1; }
git fetch https://github.com/Knikt/APL-TV.git "refs/tags/$tag:refs/tags/upstream/$tag"
if git merge-base --is-ancestor "refs/tags/upstream/$tag" HEAD; then
    echo "Already includes upstream $tag"
    exit 0
fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
if ! git merge --no-commit --no-ff "refs/tags/upstream/$tag"; then
    # Only generated manifests may be rebuilt automatically. Source conflicts stop publication.
    while IFS= read -r file; do
        case "$file" in
            app/js/build.js|app/version.json) git checkout --theirs -- "$file"; git add "$file" ;;
            *) echo "::error::Upstream conflict in $file. Resolve it before releasing."; exit 1 ;;
        esac
    done < <(git diff --name-only --diff-filter=U)
fi
python3 tools/make-build.py --notes 'MMA events, cricket teams and live-first ordering; updated from Knikt/APL-TV.'
git add app/js/build.js app/version.json app/css/tv2.css
git commit -m "Merge Knikt/APL-TV $tag while retaining custom sports"
