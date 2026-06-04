#!/bin/bash

pip install "pykx~=2.5"
python -c "import pykx;pykx.install_into_QHOME()"
node build-api.js
