import pynwb
import h5py
from lindi_cloud import lindi_cloud_load, lindi_cloud_upload, lindi_cloud_cleanup


def example1():
    url = 'https://kerchunk.neurosift.org/dandi/dandisets/000728/assets/812eb615-b4f6-4b27-87db-8a51a9914e17/zarr.json'
    staging_dir = 'test_staging'
    client = lindi_cloud_load(url, staging_dir=staging_dir)
    try:
        with pynwb.NWBHDF5IO(file=client, mode='r') as io:
            nwb = io.read()
            print(nwb)

        # modify the age of the subject
        subject = client['general']['subject']  # type: ignore
        assert isinstance(subject, h5py.Group)
        del subject['age']  # type: ignore
        subject.create_dataset('age', data=b'3w')

        lindi_cloud_upload(client, 'https://lindi.neurosift.org/zones/magland/test1/f/test1.json', consolidate_chunks=True)
    finally:
        lindi_cloud_cleanup(client)


if __name__ == '__main__':
    example1()
