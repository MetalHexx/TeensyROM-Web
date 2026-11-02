#!/usr/bin/env python3
"""Writes a GitHub-shaped releases feed for testing `trom update` without GitHub.

    fake_release_feed.py <dir> <next-version> <asset>... [--port N] [--digest sha256|wrong|none]

<dir> receives releases.json and a copy of each asset. Serve it with
`python3 -m http.server <port> --bind 127.0.0.1 --directory <dir>` and point trom at it:
TROM_RELEASES_URL=http://127.0.0.1:<port>/releases.json

The feed holds the next release (carrying the assets), an older release with no assets, and a draft of a
far newer version that trom must ignore.
"""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def asset_entry(path, base_url, digest_mode):
    entry = {
        "name": path.name,
        "state": "uploaded",
        "content_type": "application/octet-stream",
        "size": path.stat().st_size,
        "browser_download_url": f"{base_url}/{path.name}",
    }
    if digest_mode == "sha256":
        entry["digest"] = f"sha256:{sha256_of(path)}"
    elif digest_mode == "wrong":
        entry["digest"] = "sha256:" + "0" * 64
    else:
        entry["digest"] = None
    return entry


def release(version, base_url, assets, draft=False):
    return {
        "tag_name": f"v{version}",
        "name": f"TeensyROM Suite v{version}",
        "draft": draft,
        "prerelease": "-" in version,
        "published_at": "2026-01-01T00:00:00Z",
        "html_url": f"{base_url}/releases/v{version}",
        "assets": assets,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dir")
    parser.add_argument("next_version")
    parser.add_argument("assets", nargs="+")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--digest", choices=["sha256", "wrong", "none"], default="sha256")
    args = parser.parse_args()

    out = Path(args.dir)
    out.mkdir(parents=True, exist_ok=True)
    base_url = f"http://127.0.0.1:{args.port}"

    entries = []
    for source in map(Path, args.assets):
        if not source.is_file():
            sys.exit(f"fake_release_feed.py: asset '{source}' not found")
        target = out / source.name
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
        entries.append(asset_entry(target, base_url, args.digest))

    feed = [
        release("9999.0.0", base_url, entries, draft=True),
        release(args.next_version, base_url, entries),
        release("0.0.1", base_url, []),
    ]

    (out / "releases.json").write_text(json.dumps(feed, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out / 'releases.json'} ({len(entries)} asset(s), next {args.next_version}, port {args.port})")


if __name__ == "__main__":
    main()
