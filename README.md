# Global Review Rotator - Render Persistent Disk Version

This version keeps the app only on GitHub + Render.

No Supabase is required.

## What it does

- Admin uploads are saved in `data/active-upload.json`.
- Progress is saved in `data/progress.json`.
- The uploaded file stays active until admin uploads a new file.
- On Render, you must use a paid service with Persistent Disk enabled.

## Local run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Render setup

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

### Add Persistent Disk

In Render:

1. Open your Web Service.
2. Go to Settings.
3. Find Disks.
4. Click Add Disk.
5. Use this Mount Path:

```text
/opt/render/project/src/data
```

6. Size: 1 GB is enough.
7. Save.
8. Redeploy.

Important: the mount path must match the app's `data` folder.

## Optional Environment Variable

You can also add this in Render Environment:

```text
DATA_DIR=/opt/render/project/src/data
```

This is optional if the disk mount path is already `/opt/render/project/src/data`.

## Upload format

Upload CSV, XLS, or XLSX.
The file must contain:

- at least one URL starting with `http://` or `https://`
- at least one text suggestion

The parser finds URLs and text from the first sheet/file automatically.
