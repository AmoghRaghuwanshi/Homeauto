"""Explicit online setup only: pinned downloads, SHA-256 verification, atomic commit."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads(Path(__file__).with_name("whisper-manifest.json").read_text("utf-8"))
TARGET = ROOT / ".local" / "speech-assets" / "whisper-medium"


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verified(file, entry):
    return file.is_file() and not file.is_symlink() and file.stat().st_size == entry["bytes"] and digest(file) == entry["sha256"]


def download(entry):
    name = entry["file"]
    if Path(name).name != name or name in (".", ".."):
        raise ValueError("invalid manifest path")
    destination = TARGET / name
    if verified(destination, entry):
        print(f"Verified existing {name}", flush=True)
        return
    if destination.is_symlink():
        raise ValueError("refusing symlink output")
    url = f'https://huggingface.co/{MANIFEST["repository"]}/resolve/{MANIFEST["revision"]}/{name}'
    size = entry["bytes"]
    chunk_size = 16 * 1024 * 1024
    ranges = [(start, min(start + chunk_size, size) - 1) for start in range(0, size, chunk_size)]

    def part(bounds):
        start, end = bounds
        target = TARGET / f".{name}.{start}.part"
        if target.is_symlink():
            raise ValueError("refusing symlink output")
        if target.is_file() and target.stat().st_size == end - start + 1:
            return target
        for attempt in range(5):
            try:
                headers = {"User-Agent": "HomeAuto-local-model-setup"}
                if len(ranges) > 1:
                    headers["Range"] = f"bytes={start}-{end}"
                with urlopen(Request(url + f"?download=true&homeauto_part={start}", headers=headers), timeout=45) as response:
                    if len(ranges) > 1 and (response.status != 206 or response.headers.get("Content-Range") != f"bytes {start}-{end}/{size}"):
                        raise ValueError("range response mismatch")
                    received = 0
                    with target.open("wb") as output:
                        while data := response.read(min(1024 * 1024, end - start + 2 - received)):
                            received += len(data)
                            if received > end - start + 1:
                                raise ValueError("oversized response")
                            output.write(data)
                    if received != end - start + 1:
                        raise ValueError("truncated response")
                return target
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(min(2 ** attempt, 8))

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        parts = []
        for index, file in enumerate(pool.map(part, ranges), 1):
            parts.append(file)
            print(f"{name}: {index}/{len(ranges)} parts", flush=True)
    staging = TARGET / f".{name}.verified-part"
    if staging.is_symlink():
        raise ValueError("refusing symlink output")
    with staging.open("wb") as output:
        for file in parts:
            with file.open("rb") as source:
                while data := source.read(1024 * 1024):
                    output.write(data)
    if not verified(staging, entry):
        for file in parts:
            file.unlink()
        staging.unlink(missing_ok=True)
        raise ValueError(f"checksum mismatch: {name}")
    staging.replace(destination)
    for file in parts:
        file.unlink()
    print(f"SHA-256 verified {name}", flush=True)


if __name__ == "__main__":
    TARGET.mkdir(parents=True, exist_ok=True)
    for item in MANIFEST["files"]:
        download(item)
    print("Whisper medium installed. Runtime will use local files only.", flush=True)
