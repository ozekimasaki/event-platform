# API Specification

## Base URL

```
https://api.event-platform.workers.dev/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase-jwt>
```

## Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-31T00:00:00.000Z"
  }
}
```

### Events

#### List Events

```
GET /api/events?page=1&limit=20&status=published&search=keyword&tag=tech
```

#### Get Event

```
GET /api/events/:id
```

#### Create Event

```
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Event Title",
  "description": "Event description",
  "pricing_type": "paid",
  "base_price": 5000,
  "currency": "JPY",
  "capacity": 100,
  "start_at": "2026-08-01T10:00:00Z",
  "end_at": "2026-08-01T18:00:00Z",
  "venue_name": "Venue Name",
  "tags": ["tech", "conference"]
}
```

#### Update Event

```
PUT /api/events/:id
Authorization: Bearer <token>
```

#### Delete Event

```
DELETE /api/events/:id
Authorization: Bearer <token>
```

### Registrations

#### Register for Event

```
POST /api/events/:eventId/register
Authorization: Bearer <token>
```

#### Get My Registrations

```
GET /api/my/registrations
Authorization: Bearer <token>
```

### Check-in

#### Check In Attendee

```
POST /api/events/:eventId/check-in
Authorization: Bearer <token>

{
  "registrationId": "uuid"
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `INTERNAL_ERROR` - Server error
