# Analytics ingest + admin API. Build context is the repo root (see docker-compose).
FROM golang:1.24-alpine AS build
WORKDIR /src

# Build the analytics module standalone (ignore the go.work workspace so we don't
# need the sibling api module in the image).
ENV GOWORK=off
COPY services/analytics/go.mod services/analytics/go.sum ./
RUN go mod download
COPY services/analytics/ ./
RUN CGO_ENABLED=0 go build -o /bin/analytics ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /bin/analytics /bin/analytics
EXPOSE 4001
ENTRYPOINT ["/bin/analytics"]
