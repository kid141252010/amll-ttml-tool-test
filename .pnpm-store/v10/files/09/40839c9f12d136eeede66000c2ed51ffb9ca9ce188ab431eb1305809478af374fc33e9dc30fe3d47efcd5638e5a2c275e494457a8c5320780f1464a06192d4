import fs from "node:fs";
import { generateUniqueName, getOutcomeCount } from "./unique_name";
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
  const path = generateUniqueName(template);
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
      fs.close(fd, function(err2) {
        callback(err2, path);
      });
    } else {
      callback(null, path);
    }
  };
  if (isDir) {
    fs.mkdir(path, mode, fn);
  } else {
    fs.open(path, "ax+", mode, fn);
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
    retryCount: getOutcomeCount(template) * RETRY_MULTIPLIER,
    template
  });
}
function createFileSync(template, mode = _r________) {
  let path;
  let isExist;
  let retryCount = getOutcomeCount(template);
  do {
    isExist = false;
    path = generateUniqueName(template);
    let fd = null;
    try {
      fd = fs.openSync(path, "ax+", mode);
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
        fs.closeSync(fd);
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
    retryCount: getOutcomeCount(template) * RETRY_MULTIPLIER,
    template
  });
}
function createDirSync(template, mode = _rw_______) {
  let path;
  let isExist;
  let retryCount = getOutcomeCount(template);
  do {
    isExist = false;
    path = generateUniqueName(template);
    try {
      fs.mkdirSync(path, mode);
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
export {
  createDir,
  createDirSync,
  createFile,
  createFileSync
};
//# sourceMappingURL=creation.mjs.map