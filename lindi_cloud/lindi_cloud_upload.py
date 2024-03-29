import tempfile
import json
import os
import requests
import lindi
from .LindiCloudStore import LindiCloudStore


def lindi_cloud_upload(
    client: lindi.LindiH5pyFile,
    url: str,
    consolidate_chunks: bool = True
):
    if not url.startswith('https://lindi.neurosift.org/zones/'):
        raise ValueError("url must start with 'https://lindi.neurosift.org/zones/'")
    url_parts = url.split('/')
    if len(url_parts) < 8:
        raise ValueError("Invalid url")
    zone_user = url_parts[4]
    zone_name = url_parts[5]
    aa = url_parts[6]
    if aa != 'f':
        raise Exception(f'url expected to start with https://lindi.neurosift.org/zones/{zone_user}/{zone_name}/f')
    base_zone_url = f'https://lindi.neurosift.org/zones/{zone_user}/{zone_name}'
    # make sure github access token is available
    github_access_token = _get_github_access_token()
    store = client._zarr_store
    if not isinstance(store, LindiCloudStore):
        raise ValueError("The zarr store for this client is not a LindiCloudStore")
    if consolidate_chunks:
        store.consolidate_chunks()
    staging_subdir = store._staging_subdir
    if staging_subdir is not None:
        staging_subdir_is_empty = not os.path.exists(staging_subdir) or len(os.listdir(staging_subdir)) == 0
        if not staging_subdir_is_empty:
            blob_mapping = _upload_directory_of_blobs(staging_subdir, base_zone_url=base_zone_url, github_access_token=github_access_token)
            for k, v in store._rfs['refs'].items():
                if isinstance(v, list) and len(v) == 3:
                    url1 = v[0]
                    if url1.startswith(staging_subdir):
                        url2 = blob_mapping.get(url1, None)
                        if url2 is None:
                            raise ValueError(f"Could not find url in blob mapping: {url1}")
                        store._rfs['refs'][k][0] = url2
    with tempfile.TemporaryDirectory() as tmpdir:
        rfs_fname = f'{tmpdir}/rfs.json'
        with open(rfs_fname, "w") as f:
            json.dump(store._rfs, f, indent=2, sort_keys=True)
        print(f'Uploading to {url}')
        _upload_file(fname=rfs_fname, url=url, github_access_token=github_access_token)
    print('Done')


def _get_github_access_token():
    # look for the github access token in ~/.lindi-cloud/github_access_token
    # if not there, raise an exception
    home = os.path.expanduser("~")
    github_access_token_file = f"{home}/.lindi-cloud/github_access_token"
    if not os.path.exists(github_access_token_file):
        raise ValueError("No github access token found")
    with open(github_access_token_file, "r") as f:
        return f.read().strip()


def _upload_file(*, fname: str, url: str, github_access_token: str, skip_if_exists: bool = False) -> None:
    if skip_if_exists:
        exists = _check_file_exists_with_head_request(url)
        if exists:
            print('Already exists.')
            return
    signed_upload_url = _get_signed_upload_url(url, github_access_token)
    # make a put request and stream the file
    with open(fname, "rb") as f:
        resp_upload = requests.put(signed_upload_url, data=f, timeout=60 * 60 * 24 * 7)
        if resp_upload.status_code != 200:
            raise Exception(f"Problem uploading file: {resp_upload.text}")


def _check_file_exists_with_head_request(url: str) -> bool:
    resp = requests.head(url)
    if resp.status_code == 200:
        return True
    elif resp.status_code == 404:
        return False
    else:
        raise Exception(f"Problem checking if file exists: {resp.text}")


def _upload_directory_of_blobs(staging_dir: str, base_zone_url: str, github_access_token: str) -> dict:
    all_files = []
    for root, dirs, files in os.walk(staging_dir):
        for fname in files:
            full_fname = f"{root}/{fname}"
            all_files.append(full_fname)
    blob_mapping = {}
    for i, full_fname in enumerate(all_files):
        relative_fname = full_fname[len(staging_dir):]
        size_bytes = os.path.getsize(full_fname)
        print(f'Uploading blob {i + 1} of {len(all_files)} {relative_fname} ({_format_size_bytes(size_bytes)})')
        sh = _compute_sha1_of_file(full_fname)
        blob_url = f"{base_zone_url}/sha1/{sh[0]}{sh[1]}/{sh[2]}{sh[3]}/{sh[4]}{sh[5]}/{sh}"
        _upload_file(fname=full_fname, url=blob_url, github_access_token=github_access_token, skip_if_exists=True)
        blob_mapping[full_fname] = blob_url
    return blob_mapping


def _format_size_bytes(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} bytes"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / 1024 / 1024:.1f} MB"
    else:
        return f"{size_bytes / 1024 / 1024 / 1024:.1f} GB"


def _compute_sha1_of_file(fname: str) -> str:
    import hashlib
    sha1 = hashlib.sha1()
    with open(fname, "rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            sha1.update(data)
    return sha1.hexdigest()


def _get_signed_upload_url(url: str, github_access_token: str) -> str:
    headers = {
        'Authorization': f'token {github_access_token}'
    }
    api_url = 'http://localhost:3000/api/getUploadUrl'
    # api_url = 'https://lindi-cloud.vercel.app/api/getUploadUrl'
    resp = requests.post(api_url, headers=headers, json={
        "type": "getUploadUrl",
        "url": url
    })
    if resp.status_code != 200:
        raise Exception(f"Problem getting signed upload url: {resp.text}")
    return resp.json()['signedUrl']
