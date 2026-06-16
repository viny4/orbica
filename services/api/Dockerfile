# Orbica API — multi-stage Go build
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY services/api/go.mod services/api/go.sum* ./
RUN go mod download
COPY services/api/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/api ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/api"]
