ARG UBUNTU_VER=24.04
ARG NODE_VER=20
# x86_64 or aarch64
ARG ARCH=aarch64

FROM ubuntu:${UBUNTU_VER}

# FROM の後に再宣言が必要！
ARG ARCH
ARG NODE_VER

# 必要なパッケージをインストール
RUN apt-get update && apt-get install -y \
    curl unzip python3 python3-pip groff less git

# Volta + Node.js を root でインストール
RUN curl -o- https://get.volta.sh | bash && \
    /root/.volta/bin/volta install node@${NODE_VER}

# Volta のパスを永続化（全ユーザー用）
ENV VOLTA_HOME="/root/.volta"
ENV PATH="${VOLTA_HOME}/bin:${PATH}"

# npm / nest CLI をグローバルインストール
RUN npm i -g npm @nestjs/cli

# AWS CLI のインストール
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-${ARCH}.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Session Manager Plugin のインストール
RUN if [ "$ARCH" = "x86_64" ]; then \
      curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"; \
    else \
      curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_arm64/session-manager-plugin.deb" -o "session-manager-plugin.deb"; \
    fi \
    && dpkg -i session-manager-plugin.deb \
    && rm session-manager-plugin.deb

WORKDIR /apl
