FROM alpine:3.20

# tinyproxy from the official Alpine package repository (no third-party image).
RUN apk add --no-cache tinyproxy

COPY tinyproxy.conf /etc/tinyproxy/tinyproxy.conf

EXPOSE 8888

# -d keeps tinyproxy in the foreground and logs to stdout (visible via docker logs).
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
    CMD nc -z localhost 8888 || exit 1

CMD ["tinyproxy", "-d", "-c", "/etc/tinyproxy/tinyproxy.conf"]
