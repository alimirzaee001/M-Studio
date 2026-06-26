# Architect Portfolio Backend

Dynamic, block-based backend for an architect portfolio website. Supports custom project sections, media uploads with WebP compression, clickable image logic, and drag-and-drop sort ordering.

## Stack

- Node.js + TypeScript
- Express
- Prisma ORM (SQLite)
- Sharp (WebP image processing)
- Multer (file uploads)
- Zod (validation)

## Setup

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment**

Copy `.env.example` to `.env` (already done if cloned with defaults):

```
DATABASE_URL="file:./dev.db"
PORT=3000
```

3. **Run database migration**

```bash
npx prisma migrate dev --name init
```

4. **Seed sample data**

```bash
npm run seed
```

5. **Start development server**

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## Admin Panel

Open **`http://localhost:3000/admin`** in your browser to manage projects through a visual interface.

Features:
- Create, edit, and delete projects
- Upload header images (auto-compressed to WebP)
- Add custom sections with inline title editing
- Drag-and-drop reordering for sections and media
- Upload images with optional clickable high-res lightbox versions
- Add video links to sections
- Delete sections and individual media items

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects (`id`, `title`, `header_image_url`) |
| GET | `/api/projects/:id` | Full project with ordered sections and media |

### Admin (stub auth — no credentials required yet)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/upload` | Upload a single image (returns `{ url }`) |
| POST | `/api/admin/projects` | Create project |
| PUT | `/api/admin/projects/:id` | Update project |
| DELETE | `/api/admin/projects/:id` | Delete project (cascades) |
| POST | `/api/admin/projects/:id/sections` | Add section |
| PUT | `/api/admin/sections/:section_id` | Update section title |
| PUT | `/api/admin/sections/:section_id/reorder` | Bulk reorder sections |
| DELETE | `/api/admin/sections/:section_id` | Delete section |
| POST | `/api/admin/sections/:section_id/media` | Upload media |
| PUT | `/api/admin/media/:media_id/reorder` | Bulk reorder media |
| DELETE | `/api/admin/media/:media_id` | Delete media |

### Reorder payload

```json
{
  "items": [
    { "id": "uuid-1", "sort_order": 0 },
    { "id": "uuid-2", "sort_order": 1 }
  ]
}
```

### Media upload (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `media_file` | file | Yes (for images) | Grid display image |
| `target_media_file` | file | If `is_clickable=true` | High-res lightbox image |
| `media_type` | string | No | `image` (default) or `video_link` |
| `media_url` | string | For `video_link` | External video URL |
| `is_clickable` | boolean | No | Default `false` |
| `sort_order` | number | No | Auto-assigned if omitted |

## Business Rules

- If `is_clickable` is `true`, `target_media_url` (or `target_media_file` for uploads) is required.
- If `is_clickable` is `false`, `target_media_url` is always stored and returned as `null`.
- Sections and media are always returned sorted by `sort_order` ascending.

## Project Structure

```
prisma/
  schema.prisma    # Database models
  seed.ts          # Sample data
src/
  controllers/     # Request handlers
  middleware/      # Auth stub, upload, error handling
  routes/          # Public & admin routes
  services/        # Image processing (sharp)
  validation/      # Zod schemas
  utils/           # Serializers (snake_case output)
  app.ts           # Express app
  server.ts        # Entry point
uploads/           # Processed media files (gitignored)
```
