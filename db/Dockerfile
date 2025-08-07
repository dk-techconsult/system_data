FROM mysql:8.0-debian

USER root

RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

COPY init.sql /docker-entrypoint-initdb.d/