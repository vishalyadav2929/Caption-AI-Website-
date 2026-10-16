// Projects saved in this browser (IndexedDB): the media file itself plus the edit (captions, style,
// text, sounds, colour). Nothing leaves the device. Every call fails soft: no storage = no projects.

// Two stores: small project records (listed on the home page, saved on every edit) and the media
// files, written once, so autosave never rewrites a 400 MB video.
const DB = 'vcz-projects', STORE = 'projects', FILES = 'files';
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); r.result.createObjectStore(FILES); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}
async function run(mode, fn, store = STORE) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  });
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** All projects, newest first. */
export async function listProjects() {
  try { return ((await run('readonly', s => s.getAll())) || []).sort((a, b) => b.updated - a.updated); } catch { return []; }
}
export async function getProject(id) { try { return await run('readonly', s => s.get(id)); } catch { return null; } }
export async function deleteProject(id) {
  try { await run('readwrite', s => s.delete(id)); await run('readwrite', s => s.delete(id), FILES); } catch { /* nothing to delete */ }
}
/** The project's media file (Blob), or null if it couldn't be stored. */
export async function getProjectFile(id) { try { return (await run('readonly', s => s.get(id), FILES)) || null; } catch { return null; } }
/** Store the media once. Returns false when this device's storage is full or blocked. */
export async function putProjectFile(id, blob) { try { await run('readwrite', s => s.put(blob, id), FILES); return true; } catch { return false; } }

/** Save a project record (insert or replace). */
export async function putProject(p) { try { await run('readwrite', s => s.put(p)); return true; } catch { return false; } }
/** Update some fields of a saved project. */
export async function patchProject(id, patch) {
  const p = await getProject(id);
  return p ? putProject({ ...p, ...patch, updated: Date.now() }) : false;
}
