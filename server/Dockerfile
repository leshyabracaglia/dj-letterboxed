FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /out/api ./api
COPY --from=build /out/migrate ./migrate
COPY migrations ./migrations
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/app/api"]
