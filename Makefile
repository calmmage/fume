# Fume — WebGPU soap-film and smoke toy.
# The sandbox live preview is 0.0.0.0:8080. On this Mac, Homebrew nginx
# already owns that port, so `make dev` moves to the next free port.
.DEFAULT_GOAL := help
DEV_PORT ?= 8080
DEV_FALLBACK_PORTS := 5173 8082 8088 4173 8090
.PHONY: help install dev build build-dev migrate preview preview-restart preview-stop typecheck check-auth test lint format

help:  ## this list
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-16s %s\n", $$1, $$2}'

install:  ## npm install
	npm install

dev:  ## vite dev on 8080, or the next free port
	@port="$(DEV_PORT)"; \
	if lsof -nP -iTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then \
	  owner=$$(lsof -nP -iTCP:$$port -sTCP:LISTEN | awk 'NR==2 {print $$1}'); \
	  echo "port $$port is already in use ($$owner)."; \
	  port=""; \
	  for candidate in $(DEV_FALLBACK_PORTS); do \
	    if ! lsof -nP -iTCP:$$candidate -sTCP:LISTEN >/dev/null 2>&1; then \
	      port="$$candidate"; \
	      break; \
	    fi; \
	  done; \
	  if [ -z "$$port" ]; then \
	    echo "no free dev port (tried $(DEV_PORT) $(DEV_FALLBACK_PORTS))."; \
	    exit 1; \
	  fi; \
	  echo "starting on http://127.0.0.1:$$port"; \
	fi; \
	node scripts/with-app-env.mjs ./node_modules/.bin/vite dev --host 0.0.0.0 --port "$$port"

build:  ## production build, then migrate
	npm run build

build-dev:  ## vite build --mode development
	npm run build:dev

migrate:  ## apply database migrations
	npm run db:migrate

preview:  ## serve the production build
	npm run preview

preview-restart:  ## restart the built-output preview
	npm run preview:restart

preview-stop:  ## stop the built-output preview
	npm run preview:stop

typecheck:  ## tsc --noEmit
	npm run typecheck

check-auth:  ## auth invariant check
	npm run check:auth

test:  ## unit tests
	npm run test

lint:  ## eslint
	npm run lint

format:  ## prettier --write
	npm run format
