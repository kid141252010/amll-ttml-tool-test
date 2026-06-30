"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var creation_exports = {};
__export(creation_exports, {
  createDir: () => createDir,
  createDirSync: () => createDirSync,
  createFile: () => createFile,
  createFileSync: () => createFileSync
});
module.exports = __toCommonJS(creation_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_unique_name = require("./unique_name");
const _r________ = 384;
const _rw_______ = 448;
const RETRY_MULTIPLIER = 3;
function isMode(mode) {
  return typeof mode === "number" || typeof mode === "string";
}
function isErrnoException(error) {
  if (typeof error === "object" && error !== null) {
    return "code" in error;
  }
  return false;
}
function tryCreate({
  callback,
  isDir,
  mode,
  retryCount,
  template
}) {
  const path = (0, import_unique_name.generateUniqueName)(template);
  const fn = function(err, fd) {
    if (err) {
      if (err.code === "EEXIST") {
        if (retryCount > 0) {
          setImmediate(tryCreate, {
            callback,
            isDir,
            mode,
            retryCount: retryCount - 1,
            template
          });
        } else {
          callback(new RangeError("over max retry count"), null);
        }
      } else {
        callback(err, null);
      }
      return;
    }
    if (fd) {
      import_node_fs.default.close(fd, function(err2) {
        callback(err2, path);
      });
    } else {
      callback(null, path);
    }
  };
  if (isDir) {
    import_node_fs.default.mkdir(path, mode, fn);
  } else {
    import_node_fs.default.open(path, "ax+", mode, fn);
  }
}
function createFile(template, mode = _r________, callback) {
  if (typeof mode === "function") {
    callback = mode;
    mode = _r________;
  }
  if (typeof callback !== "function") {
    return new Promise(function(resolve, reject) {
      if (isMode(mode)) {
        createFile(template, mode, function(err, path) {
          if (err) {
            reject(err);
          } else {
            resolve(path);
          }
        });
      } else {
        reject(new TypeError(`mode must be a fs.Mode: ${mode}`));
      }
    });
  }
  tryCreate({
    callback,
    isDir: false,
    mode,
    retryCount: (0, import_unique_name.getOutcomeCount)(template) * RETRY_MULTIPLIER,
    template
  });
}
function createFileSync(template, mode = _r________) {
  let path;
  let isExist;
  let retryCount = (0, import_unique_name.getOutcomeCount)(template);
  do {
    isExist = false;
    path = (0, import_unique_name.generateUniqueName)(template);
    let fd = null;
    try {
      fd = import_node_fs.default.openSync(path, "ax+", mode);
    } catch (err) {
      if (isErrnoException(err) && err.code === "EEXIST") {
        if (retryCount > 0) {
          isExist = true;
        } else {
          throw new RangeError("over max retry count");
        }
      } else {
        throw err;
      }
    } finally {
      if (fd !== null) {
        import_node_fs.default.closeSync(fd);
      }
    }
    retryCount -= 1;
  } while (isExist);
  return path;
}
function createDir(template, mode = _rw_______, callback) {
  if (typeof mode === "function") {
    callback = mode;
    mode = _rw_______;
  }
  if (typeof callback !== "function") {
    return new Promise(function(resolve, reject) {
      if (isMode(mode)) {
        createDir(template, mode, function(err, path) {
          if (err) {
            reject(err);
          } else {
            resolve(path);
          }
        });
      } else {
        reject(new TypeError(`mode must be a fs.Mode: ${mode}`));
      }
    });
  }
  tryCreate({
    callback,
    isDir: true,
    mode,
    retryCount: (0, import_unique_name.getOutcomeCount)(template) * RETRY_MULTIPLIER,
    template
  });
}
function createDirSync(template, mode = _rw_______) {
  let path;
  let isExist;
  let retryCount = (0, import_unique_name.getOutcomeCount)(template);
  do {
    isExist = false;
    path = (0, import_unique_name.generateUniqueName)(template);
    try {
      import_node_fs.default.mkdirSync(path, mode);
    } catch (err) {
      if (isErrnoException(err) && err.code === "EEXIST") {
        if (retryCount > 0) {
          isExist = true;
        } else {
          throw new RangeError("over max retry count");
        }
      } else {
        throw err;
      }
    }
    retryCount -= 1;
  } while (isExist);
  return path;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createDir,
  createDirSync,
  createFile,
  createFileSync
});
//# sourceMappingURL=creation.js.map