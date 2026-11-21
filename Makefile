.PHONY: dev build preview test typecheck lint precache quality

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm test

typecheck:
	npx tsc --noEmit

lint:
	npx eslint .

precache: build
	npx tsx tools/check-precache.ts

quality: typecheck lint test build precache
