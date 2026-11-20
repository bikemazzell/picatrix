.PHONY: dev build preview test typecheck lint quality

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

quality: typecheck lint test build
