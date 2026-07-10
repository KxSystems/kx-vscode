#!/bin/bash

# Runs qcumber in a docker image
# usage:
# qcumber.sh -src test/main.q -test test
#
# License: the container needs a kdb+ license as the KDB_K4LICENSE_B64 env var
# (this is how CI passes it, from a secret). If unset, this script base64-encodes
# a k4.lic file, looked up in order: $QLIC/k4.lic, $QHOME/k4.lic, ~/.kx/k4.lic

if [ -z "$KDB_K4LICENSE_B64" ]; then
    for lic in "$QLIC/k4.lic" "$QHOME/k4.lic" "$HOME/.kx/k4.lic"; do
        if [ -n "$lic" ] && [ -f "$lic" ]; then
            export KDB_K4LICENSE_B64=$(base64 -i "$lic")
            break
        fi
    done
fi

if [ -z "$KDB_K4LICENSE_B64" ]; then
    echo "error: no kdb+ license found. Set KDB_K4LICENSE_B64, or place k4.lic in \$QLIC, \$QHOME, or ~/.kx/." >&2
    exit 1
fi

QBUILD_IMAGE="registry.gitlab.com/kxdev/cloud/packaging/qpacker/qpbuild:2.1.41"
QBUILD_REGISTRY="registry.gitlab.com"

# The image lives in a private GitLab registry. If it isn't already local, pull
# it. We log in first only when we have a way to: GITLAB_TOKEN (a GitLab PAT with
# read_registry scope), or an interactive prompt. Otherwise we assume docker is
# already authenticated (e.g. CI logs in via docker/login-action beforehand).
if ! docker image inspect "$QBUILD_IMAGE" >/dev/null 2>&1; then
    echo "image $QBUILD_IMAGE not found locally; pulling from $QBUILD_REGISTRY (private)."
    if [ -z "$GITLAB_TOKEN" ] && [ -t 0 ]; then
        read -rsp "GitLab token (read_registry scope, blank if already logged in): " GITLAB_TOKEN
        echo
    fi
    if [ -n "$GITLAB_TOKEN" ]; then
        if ! echo "$GITLAB_TOKEN" | docker login "$QBUILD_REGISTRY" -u oauth2 --password-stdin; then
            echo "error: docker login to $QBUILD_REGISTRY failed." >&2
            exit 1
        fi
    fi
    if ! docker pull "$QBUILD_IMAGE"; then
        echo "error: failed to pull $QBUILD_IMAGE. Log in to $QBUILD_REGISTRY (docker login) or set GITLAB_TOKEN." >&2
        exit 1
    fi
fi

CMD="/app/qbuild/scripts/qcumber -color -q $*"
SETUP="if [ -f /app/project/test/q/preTest.sh ]; then source /app/project/test/q/preTest.sh; fi"

docker run --rm \
    -e KDB_K4LICENSE_B64 \
    -v $(pwd):/app/project \
    -w /app/project \
    "$QBUILD_IMAGE" \
    bash -c "$SETUP; $CMD"
