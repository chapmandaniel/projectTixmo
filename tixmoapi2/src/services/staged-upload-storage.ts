import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { Request } from 'express';
import { StorageEngine } from 'multer';

const staging = Symbol('stagedUpload');
type StagedFile = Express.Multer.File & { [staging]?: { remove: () => Promise<void> } };

/** Own the writer as well as the path: Multer can remove a pending file before fs.open finishes. */
export function stagedUploadStorage(destination = os.tmpdir()): StorageEngine {
  return {
    _handleFile(req: Request, file: StagedFile, callback) {
      const filename = `tixmo-upload-${randomUUID()}`;
      const filePath = path.join(destination, filename);
      file.path = filePath;
      const writer = fs.createWriteStream(filePath, { flags: 'wx', mode: 0o600 });
      let finished = false;
      let failure: Error | undefined;
      let removal: Promise<void> | undefined;
      const closed = new Promise<void>((resolve) => writer.once('close', resolve));
      const remove = () => {
        if (!removal) {
          removal = (async () => {
            file.stream.unpipe(writer);
            writer.destroy();
            // destroy waits for a pending open, then closes the descriptor before unlink.
            await closed;
            try {
              await unlink(filePath);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
          })();
        }
        return removal;
      };
      // Symbols survive Multer's spread copy without becoming API response fields.
      file[staging] = { remove };
      const abort = () => {
        failure ||= new Error('Request aborted');
        void remove().catch(() => undefined); // Multer's _removeFile reports cleanup errors.
      };
      const prematureClose = () => {
        if (!req.readableEnded) abort();
      };
      req.once('aborted', abort);
      req.once('error', abort);
      req.once('close', prematureClose);
      writer.on('error', (error) => {
        failure = error;
      });
      writer.once('finish', () => {
        finished = true;
      });
      writer.once('close', () => {
        req.removeListener('aborted', abort);
        req.removeListener('error', abort);
        req.removeListener('close', prematureClose);
        if (failure || !finished) {
          void remove().then(
            () => callback(failure || new Error('Upload interrupted')),
            (error) => callback(error)
          );
        } else {
          callback(null, { destination, filename, path: filePath, size: writer.bytesWritten });
        }
      });
      file.stream.once('error', abort);
      file.stream.pipe(writer);
      if (req.aborted || req.destroyed) abort();
    },
    _removeFile(_req: Request, file: StagedFile, callback) {
      const cleanup =
        file[staging]?.remove() ||
        unlink(file.path).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        });
      void cleanup.then(() => callback(null), callback);
    },
  };
}
