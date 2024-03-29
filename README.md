# LINDI cloud

:warning: This software is in prototype phase.

LINDI cloud is a layer on top of [LINDI](https://github.com/neurodataWithoutBorders/lindi) that allows you to perform the following steps

1. Load a .zarr.json file from a remote location.
2. Modify that file (for example, adding new neurodata objects) using either pynwb or h5py.
3. Upload the modified file to the cloud, with the index file stored separately from the binary data files.

Important features

* You are always working with a relatively small reference file system objects (the .zarr.json files).
* When you add large datasets to the file, they get temporarily stored as chunks in a staging area on the local machine, with references in the in-memory .zarr.json object.
* When you upload the new file, the data chunks first get consolidated. For example, 100 chunk files of size 5 MB each will be consolidated into a single 500 MB file before uploading to the cloud. This can drastically reduce the number of files that need to be uploaded and stored in the cloud bucket.
* During upload, the binary data chunk files are stored in the cloud according to their SHA-1 content hashes. This means that you never need to re-upload chunks that have already been stored on the LINDI cloud.

## Example: Augmenting a DANDI NWB file

See [examples/example_add_autocorrelograms.py](examples/example_add_autocorrelograms.py) where we compute autocorrelograms for an NWB file on DANDI, add that to the Units table, upload the augmented file to the LINDI cloud, and view using Neurosift.

## LINDI cloud storage is organized into zones

Files are stored in the LINDI cloud bucket with the following scheme:

```
https://lindi.neurosift.org/zones/<gh-user>/<zone-name>/f/<file-path>
```

Raw chunk data files are stored as:

```
https://lindi.neurosift.org/zones/<gh-user>/<zone-name>/sha1/aa/bb/cc/aabbccdd....
```

The .zarr.json files contain references to the full URLs of the chunk files. Thus they are location-independent.

## Authentication

Authentication is done using a GitHub token. Users only have permission to upload to zones that start with their GitHub username.

## Garbage collection

When a .zarr.json file is deleted or replaced, some of the chunk files may become orphaned. A periodic garbage collection process could in principle remove these orphaned files. However, note that derivative files may still contain references to chunks files associated with other .zarr.json files.
