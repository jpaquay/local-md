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


def test_serve_spa_path_traversal_blocked():
    """Verify path traversal attempts using URL encoding in SPA route return 403."""
    response = client.get("/%2e%2e/server.py")
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]


def test_serve_spa_valid_or_fallback():
    """Verify normal routing returns 200 (index.html or static asset)."""
    response = client.get("/index.html")
    assert response.status_code == 200
