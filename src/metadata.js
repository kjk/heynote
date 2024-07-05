import { fsReadTextFile, fsWriteTextFile } from "./fileutil";
import { getStorageFS } from "./notes";

// meta-data about notes and functions
export const kMetadataName = "__metadata.edna.json";

/** @typedef {{
    name: string,
    altShortcut?: string,
    isStarred?: boolean,
}} NoteMetadata */

/** @typedef {{
    name: string,
    isStarred?: boolean,
}} FunctionMetadata */

/** @typedef {{
  ver: number,
  notes: NoteMetadata[],
  functions: FunctionMetadata[],
}} Metadata */

/** @type {Metadata} */
let metadata = null;

export function getMetadata() {
  return metadata;
}

/**
 * @param {string} noteName
 * @param {boolean} createIfNotExists
 * @returns {NoteMetadata}
 */
export function getMetadataForNote(noteName, createIfNotExists = false) {
  // console.log("getMetadataForNote:", noteName);
  let meta = getMetadata();
  let notes = meta.notes || [];
  for (let m of notes) {
    if (m.name === noteName) {
      return m;
    }
  }
  if (!createIfNotExists) {
    return null;
  }
  let m = {
    name: noteName,
  };
  notes.push(m);
  metadata.notes = notes;
  return m;
}

/** @typedef {(meta: NoteMetadata) => void} UpdateNoteMetadataFn */

/**
 * @param {string} noteName
 * @param {UpdateNoteMetadataFn} updateMetaFn
 * @param {boolean} save
 * @returns {Promise<Metadata>}
 */
export async function updateMetadataForNote(
  noteName,
  updateMetaFn,
  save = false,
) {
  let meta = getMetadataForNote(noteName, true);
  updateMetaFn(meta);
  let res = metadata;
  if (save) {
    res = await saveNotesMetadata(metadata);
  }
  return res;
}

/**
 * @param {string} noteName
 */
export async function removeNoteFromMetadata(noteName) {
  console.log("deleteMetadataForNote:", noteName);
  let meta = getMetadata();
  let notes = meta.notes;
  let newNotes = [];
  for (let m of notes) {
    if (m.name !== noteName) {
      newNotes.push(m);
    }
  }
  meta.notes = newNotes;
  await saveNotesMetadata(meta);
}

/**
 * @returns {Promise<Metadata>}
 */
export async function loadNotesMetadata() {
  console.log("loadNotesMetadata: started");
  let dh = getStorageFS();
  let s;
  if (!dh) {
    s = localStorage.getItem(kMetadataName);
  } else {
    try {
      s = await fsReadTextFile(dh, kMetadataName);
    } catch (e) {
      // it's ok if doesn't exist
      console.log("loadNotesMetadata: no metadata file", e);
      s = "[]";
    }
  }
  s = s || "[]";
  metadata = JSON.parse(s);
  console.log("loadNotesMetadata: finished", metadata);
  return metadata;
}

/**
 * @param {Metadata} m
 */
async function saveNotesMetadata(m) {
  let s = JSON.stringify(m, null, 2);
  let dh = getStorageFS();
  if (dh) {
    try {
      await fsWriteTextFile(dh, kMetadataName, s);
    } catch (e) {
      console.log("fsWriteTextFile failed with:", e);
    }
  } else {
    localStorage.setItem(kMetadataName, s);
  }
  metadata = m;
  return m;
}

/**
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<Metadata>}
 */
export async function renameNoteInMetadata(oldName, newName) {
  let meta = getMetadata();
  let notes = meta.notes || [];
  for (let o of notes) {
    if (o.name === oldName) {
      o.name = newName;
      break;
    }
  }
  let res = await saveNotesMetadata(meta);
  return res;
}

/**
 * @param {string} name
 * @param {string} altShortcut - "0" ... "9"
 * @returns {Promise<Metadata>}
 */
export async function reassignNoteShortcut(name, altShortcut) {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let meta = getMetadata();
  let notes = meta.notes || [];
  for (let o of notes) {
    if (o.altShortcut !== altShortcut) {
      continue;
    }
    if (o.name === name) {
      // same note: just remove shortcut
      delete o.altShortcut;
      let res = await saveNotesMetadata(meta);
      return res;
    } else {
      // a different note: remove shortcut and then assign to the new note
      delete o.altShortcut;
    }
  }

  let res = await updateMetadataForNote(
    name,
    (meta) => {
      meta.altShortcut = altShortcut;
    },
    true,
  );
  return res;
}

// TODO: temporary
export async function upgradeMetadata() {
  let meta = await loadNotesMetadata();
  if (!Array.isArray(meta)) {
    console.log("upgradeMetadata: already upgraded:", meta);
    return;
  }
  let newMeta = {
    ver: 1,
    notes: meta,
    functions: [],
  };
  console.log("upgradeMetadata: new meta:", newMeta);
  await saveNotesMetadata(newMeta);
}
