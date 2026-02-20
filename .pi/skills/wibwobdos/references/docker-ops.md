# Docker Operations

## Startup sequence (start-wibwobdos.sh)

1. Install Python deps from `requirements.txt`
2. Detect binary: check `build-linux/app/test_pattern` is ELF, build if missing
3. Start `test_pattern` with `WIBWOB_INSTANCE=N`, wait for IPC socket
4. Set terminal size (120×40) and SIGWINCH the app
5. Start uvicorn on `0.0.0.0:8089`
6. Trap EXIT/INT/TERM for clean shutdown

## Interactive build debugging

```bash
docker run --rm -it -v ../wibandwob-dos:/opt/wibwobdos -w /opt/wibwobdos symbient-wibwobdos-real bash
cmake . -B build-linux -DCMAKE_BUILD_TYPE=Release
cmake --build build-linux -j$(nproc)
```

## The SIGWINCH gotcha

Docker PTYs often start at 0×0 → empty screenshots. Fix:

```bash
docker compose exec wibwobdos bash -c '
  stty -F /dev/pts/0 rows 40 cols 120
  kill -WINCH $(pgrep test_pattern)
'
```

The start script does this automatically but it can recur on container pause/resume.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Size: 0x0` screenshot | PTY has no dimensions | SIGWINCH fix above |
| `GET /screenshot` → 405 | Real API is POST-only | `curl -X POST ... -d "{}"` |
| `Exec format error` | Mach-O binary on Linux | Build into `build-linux/` |
| `ModuleNotFoundError` | Python deps missing | Check `requirements.txt` install in startup log |
| Container exits immediately | API import failure | `docker logs symbient-wibwobdos` |
| Windows invisible | Created before terminal size set | Close all, recreate after SIGWINCH |
