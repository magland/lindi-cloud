import os
import shutil
import lindi
from .LindiCloudStore import LindiCloudStore


def lindi_cloud_cleanup(client: lindi.LindiH5pyFile):
    store = client._zarr_store
    if not isinstance(store, LindiCloudStore):
        raise ValueError("The zarr store for this client is not a LindiCloudStore")
    if store._staging_subdir is not None:
        if os.path.exists(store._staging_subdir):
            shutil.rmtree(store._staging_subdir)
