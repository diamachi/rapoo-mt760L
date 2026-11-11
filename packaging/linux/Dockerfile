ARG BASE_IMAGE=node:22-bookworm
FROM ${BASE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip desktop-file-utils file gcc libc6-dev \
    && if [ "$(dpkg --print-architecture)" = arm64 ]; then \
         apt-get install -y --no-install-recommends gcc-x86-64-linux-gnu libc6-dev-amd64-cross; \
       fi \
    && rm -rf /var/lib/apt/lists/*
