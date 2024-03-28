import lindi
from .LindiCloudStore import LindiCloudStore


def lindi_cloud_consolidate_chunks(client: lindi.LindiH5pyFile):
    store = client._zarr_store
    if not isinstance(store, LindiCloudStore):
        raise ValueError("The zarr store for this client is not a LindiCloudStore")
    store.consolidate_chunks()
