.PHONY: run build test vet migrate-up migrate-down seed compose-up compose-down

DATABASE_URL ?= postgres://beatboxd:beatboxd@localhost:5433/beatboxd?sslmode=disable

run:
	DATABASE_URL=$(DATABASE_URL) go run ./cmd/api

build:
	go build ./...

test:
	go test ./...

vet:
	go vet ./...

migrate-up:
	DATABASE_URL=$(DATABASE_URL) go run ./cmd/migrate up

migrate-down:
	DATABASE_URL=$(DATABASE_URL) go run ./cmd/migrate down

seed:
	DATABASE_URL=$(DATABASE_URL) go run ./cmd/seed

compose-up:
	docker compose up -d --build

compose-down:
	docker compose down
