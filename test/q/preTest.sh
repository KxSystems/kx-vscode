#!/bin/bash

set -euo pipefail

pip install "pykx~=2.5"
python -c "import pykx;pykx.install_into_QHOME()"

# This check is here because node isn't available in the qbuild container used in CI pipelines,
# and this would fail in qbuild. Pipelines run this as a separate step in the parent container.
if command -v node &>/dev/null; then
    node build-api.js
fi
