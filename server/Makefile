.PHONY: run build test vet migrate-up migrate-down seed compose-up compose-down openapi openapi-check

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

# Regenerates docs/{docs.go,swagger.json,swagger.yaml} from the @-annotations
# above each handler in internal/httpapi/*.go. Run this after adding or
# changing a handler, then `npm run codegen:api-types` at the repo root to
# regenerate the TS client types from swagger.json.
openapi:
	swag init -g cmd/api/main.go -o docs --parseDependency --parseInternal --useStructName --requiredByDefault

# Used by CI to fail if someone changed a handler's annotations (or added
# a new one) without regenerating the checked-in spec.
openapi-check: openapi
	git diff --exit-code docs/ || (echo "docs/ is out of date - run 'make openapi' in server/ and commit the result" && exit 1)
