import requests

def install(package_id):
    resolve = requests.get(f"http://127.0.0.1:3000/api/packages/{package_id}/resolve").json()["data"]
    artifact = requests.get(resolve["downloadUrl"]).content
    manifest = requests.get(resolve["manifestUrl"]).json()
    return artifact, manifest