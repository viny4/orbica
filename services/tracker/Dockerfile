# Orbica Tracker — multi-stage Go build
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/tracker ./cmd/tracker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/tracker /tracker
EXPOSE 8081
USER nonroot:nonroot
ENTRYPOINT ["/tracker"]
