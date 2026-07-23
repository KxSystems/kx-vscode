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
    # This caveat is because neither shell-specific dot files nor /etc/environment are read
    # when starting non-interactive non-login shells in Windows.
    # WSLENV lives in the Windows registry, and stores what windows env vars get forwarded to WSL
    # > notepad $PROFILE
    # Add the line$env:QLIC="/home/username/q"
    # > setx WSLENV "$($env:WSLENV):QLIC"
    echo "On Windows, at least one of these must be passed in via WSLENV." >&2
    exit 1
fi

QBUILD_IMAGE="registry.gitlab.com/kxdev/cloud/packaging/qpacker/qpbuild:2.1.41"
QBUILD_REGISTRY="registry.gitlab.com"

# The image lives in a private GitLab registry. If it isn't already local, pull
# it, relying on whatever credentials docker already has (this is how CI works:
# a docker/login-action step logs in beforehand). Only if that pull fails do we
# authenticate ourselves — from GITLAB_TOKEN (a GitLab PAT with read_registry
# scope) or an interactive prompt — and try once more.
if ! docker image inspect "$QBUILD_IMAGE" >/dev/null 2>&1; then
    echo "image $QBUILD_IMAGE not found locally; pulling from $QBUILD_REGISTRY (private)."
    if ! docker pull "$QBUILD_IMAGE"; then
        echo "pull failed; authenticating to $QBUILD_REGISTRY and retrying." >&2
        if [ -z "$GITLAB_TOKEN" ] && [ -t 0 ]; then
            read -rsp "GitLab token (read_registry scope): " GITLAB_TOKEN
            echo
        fi
        if [ -z "$GITLAB_TOKEN" ]; then
            echo "error: failed to pull $QBUILD_IMAGE. Log in to $QBUILD_REGISTRY (docker login) or set GITLAB_TOKEN." >&2
            exit 1
        fi
        if ! echo "$GITLAB_TOKEN" | docker login "$QBUILD_REGISTRY" -u oauth2 --password-stdin; then
            echo "error: docker login to $QBUILD_REGISTRY failed." >&2
            exit 1
        fi
        if ! docker pull "$QBUILD_IMAGE"; then
            echo "error: failed to pull $QBUILD_IMAGE after login." >&2
            exit 1
        fi
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
