#!/bin/sh
# Daily backup of the app database (cron, as t1.espar.lv — needs the docker
# group). Uses SQLite's online backup inside the running container, so the
# copy is consistent even while the app is writing. Keeps KEEP_DAYS days of
# app-auto-*.db; manual backups in the same folder are never touched.
set -eu

CONTAINER=datortiklu-testi
BACKUP_DIR=/home/www/espar.lv/t1/backups
KEEP_DAYS=30

stamp=$(date +%Y%m%d-%H%M%S)
tmp=/tmp/app-backup-$stamp.db
out=$BACKUP_DIR/app-auto-$stamp.db

docker exec "$CONTAINER" node -e "
  require('better-sqlite3')('/app/data-store/app.db', { readonly: true })
    .backup('$tmp')
    .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
"
docker cp "$CONTAINER:$tmp" "$out.part"
docker exec "$CONTAINER" rm -f "$tmp"
chmod 600 "$out.part"
mv "$out.part" "$out"

find "$BACKUP_DIR" -maxdepth 1 -name 'app-auto-*.db' -mtime +"$KEEP_DAYS" -delete
