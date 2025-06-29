#!/bin/bash
# Open API documentation in browser

echo "🚀 Opening Bravo-1 API Documentation..."
echo ""
echo "📍 Swagger UI: http://localhost:3001/api-docs"
echo "📄 OpenAPI JSON: http://localhost:3001/api-docs/openapi.json"
echo ""

# Open in default browser (macOS)
if [[ $OSTYPE == "darwin"* ]]; then
	open http://localhost:3001/api-docs
elif [[ $OSTYPE == "linux-gnu"* ]]; then
	xdg-open http://localhost:3001/api-docs
fi

echo "✅ API documentation is now available at http://localhost:3001/api-docs"
