# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS";
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from fastapi.testclient import TestClient
import server

client = TestClient(server.app)


def test_api_health():
    """Verify API health endpoint works in CI environment."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_config():
    """Verify API config endpoint works in CI environment."""
    response = client.get("/api/config")
    assert response.status_code == 200


def test_api_browse_path_traversal_blocked():
    """Verify safe_resolve blocks path traversal in browse endpoint."""
    response = client.get("/api/browse?path=../../etc")
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]
