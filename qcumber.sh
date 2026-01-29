#!/bin/bash

# Runs qcumber in a docker image
# usage:
# qcumber.sh -src test/main.q -test test

QBUILD_IMAGE="registry.gitlab.com/kxdev/cloud/packaging/qpacker/qpbuild:2.1.41"
CMD="/app/qbuild/scripts/qcumber -color -q $*"
SETUP="if [ -f /app/project/test/q/preTest.sh ]; then source /app/project/test/q/preTest.sh; fi"

docker run --rm \
    -e KDB_K4LICENSE_B64 \
    -v $(pwd):/app/project \
    -w /app/project \
    "$QBUILD_IMAGE" \
    bash -c "$SETUP; $CMD"
