from typing import Union
import os
import zarr
import lindi
from .LindiCloudStore import LindiCloudStore


def lindi_cloud_create(staging_dir: Union[str, None]):
    if staging_dir is not None:
        staging_dir = os.path.abspath(staging_dir)
    rfs = {'refs': {}}  # empty reference file system
    store = LindiCloudStore(rfs=rfs, staging_dir=staging_dir)
    zarr.group(store)  # create root group
    return lindi.LindiH5pyFile.from_zarr_store(store, mode='r+')