import time
import uuid
import numpy as np
import lindi_cloud
import h5py
from helpers.compute_correlogram_data import compute_correlogram_data


def example_add_autocorrelograms():
    # https://neurosift.app/?p=/nwb&dandisetId=000939&dandisetVersion=0.240327.2229&url=https://api.dandiarchive.org/api/assets/56d875d6-a705-48d3-944c-53394a389c85/download/
    dandiset_id = '000939'
    dandiset_version = '0.240327.2229'
    asset_id = '56d875d6-a705-48d3-944c-53394a389c85'
    zarr_json_url = 'https://lindi.neurosift.org/dandi/dandisets/000939/assets/56d875d6-a705-48d3-944c-53394a389c85/zarr.json'

    # Load the h5py-like client from remote nwb .zarr.json file
    client = lindi_cloud.lindi_cloud_load(url=zarr_json_url, staging_dir='test_staging')

    # Load the spike times from the units group
    units_group = client['/units']
    assert isinstance(units_group, h5py.Group)
    print('Loading spike times')
    spike_times = units_group['spike_times'][()]  # type: ignore
    spike_times_index = units_group['spike_times_index'][()]  # type: ignore
    num_units = len(spike_times_index)
    total_num_spikes = len(spike_times)
    print(f'Loaded {num_units} units with {total_num_spikes} total spikes')

    # Compute autocorrelograms for all the units
    print('Computing autocorrelograms')
    auto_correlograms = []
    p = 0
    timer = time.time()
    for i in range(num_units):
        spike_train = spike_times[p:spike_times_index[i]]
        elapsed = time.time() - timer
        if elapsed > 2:
            print(f'Computing autocorrelogram for unit {i + 1} of {num_units} ({len(spike_train)} spikes)')
            timer = time.time()
        r = compute_correlogram_data(
            spike_train_1=spike_train,
            spike_train_2=None,
            window_size_msec=100,
            bin_size_msec=1
        )
        bin_edges_sec = r['bin_edges_sec']
        bin_counts = r['bin_counts']
        auto_correlograms.append({
            'bin_edges_sec': bin_edges_sec,
            'bin_counts': bin_counts
        })
        p = spike_times_index[i]
    autocorrelograms_array = np.zeros(
        (num_units, len(auto_correlograms[0]['bin_counts'])),
        dtype=np.uint32
    )
    for i, ac in enumerate(auto_correlograms):
        autocorrelograms_array[i, :] = ac['bin_counts']

    # Create a new dataset in the units group to store the autocorrelograms
    ds = units_group.create_dataset('autocorrelogram', data=autocorrelograms_array)
    ds.attrs['bin_edges_sec'] = auto_correlograms[0]['bin_edges_sec'].tolist()
    ds.attrs['description'] = 'the autocorrelogram for each spike unit'
    ds.attrs['namespace'] = 'hdmf-common'
    ds.attrs['neurodata_type'] = 'VectorData'
    ds.attrs['object_id'] = str(uuid.uuid4())

    # Update the colnames attribute of the units group
    colnames = units_group.attrs['colnames']
    assert isinstance(colnames, np.ndarray)
    colnames = colnames.tolist()
    colnames.append('autocorrelogram')
    units_group.attrs['colnames'] = colnames

    # Upload the modified .nwb.zarr.json file to the cloud
    dest_url = f'https://lindi.neurosift.org/zones/magland/testing/f/dandi/dandisets/{dandiset_id}/assets/{asset_id}/aug_autocorrelograms.nwb.zarr.json'
    lindi_cloud.lindi_cloud_upload(
        client,
        dest_url,
    )
    lindi_cloud.lindi_cloud_cleanup(client)

    # For convenience print the URL for viewing the dataset in Neurosift
    ns_url = f'https://neurosift.app/?p=/nwb&dandisetId={dandiset_id}&dandisetVersion={dandiset_version}&url={dest_url}&st=lindi'
    print(ns_url)

    # For convenicence, here's the output:
    # https://neurosift.app/?p=/nwb&dandisetId=000939&dandisetVersion=0.240327.2229&url=https://lindi.neurosift.org/zones/magland/testing/f/dandi/dandisets/000939/assets/56d875d6-a705-48d3-944c-53394a389c85/aug_autocorrelograms.nwb.zarr.json&st=lindi


if __name__ == "__main__":
    example_add_autocorrelograms()
