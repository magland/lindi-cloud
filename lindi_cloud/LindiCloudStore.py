from typing import Union
import random
import string
import os
import datetime
from zarr.storage import Store as ZarrStore
from lindi.LindiH5pyFile.LindiReferenceFileSystemStore import LindiReferenceFileSystemStore


class LindiCloudStore(ZarrStore):
    def __init__(self, *, rfs: dict, staging_dir: Union[str, None]):
        self._rfs = rfs
        self._staging_dir = staging_dir
        self._rfs_store = LindiReferenceFileSystemStore(rfs, mode='r+')

        # we are going to make a staging subdir unique to this memory instance
        # so that we can use the zarr structure (for human inspection) and also
        # clean up after ourselves.
        if self._staging_dir is not None:
            unique_id = _create_random_id()
            self._staging_subdir = f"{self._staging_dir}/{unique_id}"
            os.makedirs(self._staging_subdir)
        else:
            self._staging_subdir = None

    def __getitem__(self, key: str):
        return self._rfs_store.__getitem__(key)

    def __setitem__(self, key: str, value):
        if self._staging_subdir is None:
            raise Exception("Cannot write to store without a staging directory")
        key_parts = key.split("/")
        key_base_name = key_parts[-1]
        if key_base_name.startswith('.'):  # always inline .zattrs, .zgroup, .zarray
            inline = True
        else:
            # presumably it is a chunk of an array
            if not isinstance(value, bytes):
                raise ValueError("Value must be bytes")
            size = len(value)
            inline = size < 1000
        if inline:
            # If inline, save in memory
            return self._rfs_store.__setitem__(key, value)
        else:
            # If not inline, save it as a file in the staging directory
            key_without_initial_slash = key if not key.startswith("/") else key[1:]
            staging_fname = f"{self._staging_subdir}/{key_without_initial_slash}"
            os.makedirs(os.path.dirname(staging_fname), exist_ok=True)
            with open(staging_fname, "wb") as f:
                f.write(value)
            self._set_ref_reference(key_without_initial_slash, staging_fname, 0, len(value))

    def __delitem__(self, key: str):
        # We don't delete the file from the staging directory, because that
        # would be dangerous if the file was part of a consolidated file.
        return self._rfs_store.__delitem__(key)

    def __iter__(self):
        return self._rfs_store.__iter__()

    def __len__(self):
        return self._rfs_store.__len__()

    # These methods are overridden from BaseStore
    def is_readable(self):
        return True

    def is_writeable(self):
        return True

    def is_listable(self):
        return True

    def is_erasable(self):
        return False

    def _set_ref_reference(self, key: str, filename: str, offset: int, size: int):
        if 'refs' not in self._rfs:
            self._rfs['refs'] = {}
        self._rfs['refs'][key] = [
            filename,
            offset,
            size
        ]

    def consolidate_chunks(self):
        if self._staging_subdir is None:
            raise ValueError("Cannot consolidate chunks without a staging directory")
        refs_keys_by_reference_parent_path = {}
        for k, v in self._rfs['refs'].items():
            if isinstance(v, list) and len(v) == 3:
                url = v[0]
                if not url.startswith(self._staging_subdir):
                    continue
                parent_path = os.path.dirname(url[len(self._staging_subdir):])
                if parent_path not in refs_keys_by_reference_parent_path:
                    refs_keys_by_reference_parent_path[parent_path] = []
                refs_keys_by_reference_parent_path[parent_path].append(k)
        for root, dirs, files1 in os.walk(self._staging_subdir):
            files = [
                f for f in files1
                if not f.startswith('.') and not f.startswith('consolidated.')
            ]
            if len(files) <= 1:
                continue
            refs_keys_for_this_dir = refs_keys_by_reference_parent_path.get(root, [])
            if len(refs_keys_for_this_dir) <= 1:
                continue

            offset = 0
            offset_maps = {}
            consolidated_id = _random_str(8)
            consolidated_index = 0
            max_size_of_consolidated_file = 1024 * 1024 * 1024  # 1 GB, a good size for cloud bucket files
            consolidated_fname = f"{root}/consolidated.{consolidated_id}.{consolidated_index}"
            consolidated_f = open(consolidated_fname, "wb")
            try:
                for fname in files:
                    full_fname = f"{root}/{fname}"
                    with open(full_fname, "rb") as f2:
                        consolidated_f.write(f2.read())
                    offset_maps[full_fname] = (consolidated_fname, offset)
                    offset += os.path.getsize(full_fname)
                    if offset > max_size_of_consolidated_file:
                        consolidated_f.close()
                        consolidated_index += 1
                        consolidated_fname = f"{root}/consolidated.{consolidated_id}.{consolidated_index}"
                        consolidated_f = open(consolidated_fname, "wb")
                        offset = 0
            finally:
                consolidated_f.close()
            for key in refs_keys_for_this_dir:
                filename, old_offset, old_size = self._rfs['refs'][key]
                if filename not in offset_maps:
                    continue
                consolidated_fname, new_offset = offset_maps[filename]
                self._rfs['refs'][key] = [consolidated_fname, new_offset + old_offset, old_size]
            # remove the old files
            for fname in files:
                os.remove(f"{root}/{fname}")


def _create_random_id():
    # This is going to be a timestamp suitable for alphabetical chronological order plus a random string
    return f"{_timestamp_str()}-{_random_str(8)}"


def _timestamp_str():
    return datetime.datetime.now().strftime("%Y%m%d%H%M%S")


def _random_str(n):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=n))
