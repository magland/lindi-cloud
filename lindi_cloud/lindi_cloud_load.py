import tempfile
from typing import Union
import json
import os
import urllib.request
import lindi
from .LindiCloudStore import LindiCloudStore


def lindi_cloud_load(url: str, staging_dir: Union[str, None]):
    if staging_dir is not None:
        staging_dir = os.path.abspath(staging_dir)
    if url.startswith("http") or url.startswith("https"):
        with tempfile.TemporaryDirectory() as tmpdir:
            filename = f"{tmpdir}/temp.zarr.json"
            _download_file(url, filename)
            with open(filename, "r") as f:
                rfs = json.load(f)
    else:
        with open(url, "r") as f:
            rfs = json.load(f)
    store = LindiCloudStore(rfs=rfs, staging_dir=staging_dir)
    return lindi.LindiH5pyFile.from_zarr_store(store, mode='r+')


def _download_file(url: str, filename: str) -> None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        with open(filename, "wb") as f:
            f.write(response.read())
