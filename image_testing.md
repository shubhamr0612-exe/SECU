# SECU — Image / Vision integration testing

## Endpoint
`POST /api/vision/observe`
Body: `{ "image_base64": "<base64 JPEG/PNG, no data: prefix required but tolerated>" }`

## Rules for test images
- Use base64-encoded JPEG/PNG/WEBP only.
- Image must contain real visual features (a person/object/scene). Do NOT use blank/solid-color images.
- Resize to reasonable bounds (e.g. 480-640px) before encoding.

## Expected behaviour
- Returns `{ "ok": true, "comment": "<one short friendly line about neutral visible things, may offer a selfie>" }`
- For a frame with no clear person, returns `{ "ok": true, "comment": null }`
- Must NEVER return comments about age/gender/ethnicity/body/health/emotion or identify the person.

## Quick test
```
B64=$(base64 -w0 /path/to/photo.jpg)
curl -s -X POST "$API_URL/api/vision/observe" -H "Content-Type: application/json" -d "{\"image_base64\":\"$B64\"}"
```
