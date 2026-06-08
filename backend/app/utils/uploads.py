"""Utilities for managing temporary uploaded files."""

from datetime import timedelta
from pathlib import Path
from time import time


def clean_up_old_tmp_uploads(upload_dir: Path, *, older_than: timedelta = timedelta(hours=1)) -> int:
    """Delete files in the temporary upload directory older than ``older_than``.

    Returns the number of files deleted. Missing directories are created so the
    upload endpoint can use the same location immediately after startup.
    """
    upload_dir.mkdir(parents=True, exist_ok=True)
    cutoff_timestamp = time() - older_than.total_seconds()
    deleted_count = 0

    for entry in upload_dir.iterdir():
        if not entry.is_file():
            continue
        if entry.stat().st_mtime >= cutoff_timestamp:
            continue
        entry.unlink(missing_ok=True)
        deleted_count += 1

    return deleted_count
