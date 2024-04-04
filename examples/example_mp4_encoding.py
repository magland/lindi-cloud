import numpy as np
from lindi_cloud import lindi_cloud_create, lindi_cloud_upload
from neurosift.codecs import MP4AVCCodec

MP4AVCCodec.register_codec()


def example_mp4_encoding():
    # url = 'https://api.dandiarchive.org/api/assets/9278ecc2-3d95-4757-b681-f6a44c19ebab/download/'
    fname = '/home/magland/Downloads/60d277d6-24fd-4817-bb02-41382db59172_external_file_0.avi'

    mp4avc_codec = MP4AVCCodec(fps=30)  # note: I actually don't know the fps of the video

    # Read the video into a huge numpy array
    print('Decoding video...')
    with open(fname, 'rb') as f:
        buf = f.read()
        big_array = mp4avc_codec.decode(buf)

    # Create a lindi cloud client
    print('Creating lindi cloud client...')
    client = lindi_cloud_create(staging_dir="staging")


    print('Creating group...')
    group1 = client.create_group('group1')

    print('Creating test_video...')
    test_video_group = group1.create_group('test_video')
    chunk_size = 2000
    test_video_group.create_dataset_with_zarr_compressor(
        'data',
        shape=big_array.shape,
        dtype=np.uint8,
        compressor=mp4avc_codec,
        chunks=(chunk_size, big_array.shape[1], big_array.shape[2], big_array.shape[3])
    )
    for ii in range(0, big_array.shape[0], chunk_size):
        print(f'Writing chunk {ii}...')
        test_video_group['data'][ii:ii + chunk_size] = big_array[ii:ii + chunk_size]
    test_video_group.attrs['neurodata_type'] = 'test_video'

    dest_url = "https://lindi.neurosift.org/zones/magland/test1/f/example_mp4_encoding.zarr.json"
    lindi_cloud_upload(client, dest_url)

    ns_url = f'https://neurosift.app/?p=/nwb&url={dest_url}&st=lindi'
    print(ns_url)


if __name__ == "__main__":
    example_mp4_encoding()
