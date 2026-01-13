export function info(message) {
  ui.notifications?.info?.(message);
}

export function warn(message) {
  ui.notifications?.warn?.(message);
}

export function error(message) {
  ui.notifications?.error?.(message);
}
