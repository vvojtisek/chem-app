import { z } from "zod";

import {
  ELEMENT_CARD_STORE,
  openLearningDatabase,
  requestCompleted,
  transactionCompleted,
} from "./browser-learning-database";

export const elementCardSchema = z.object({
  id: z.string().min(1),
  atomicNumber: z.number().int().min(1).max(118),
  symbol: z.string().regex(/^[A-Z][a-z]?$/u),
  nameCs: z.string().min(1),
  nameLat: z.string().min(1),
  period: z.number().int().min(1).max(7),
  group: z.number().int().min(1).max(18).nullable(),
  atomicWeight: z.number().positive(),
  valenceConfiguration: z.string().min(1),
  kind: z.enum(["override", "custom"]),
  updatedAt: z.iso.datetime(),
});

export type StoredElementCard = z.infer<typeof elementCardSchema>;

export interface BrowserElementCardStore {
  list(): Promise<readonly StoredElementCard[]>;
  remove(id: string): Promise<void>;
  upsert(card: StoredElementCard): Promise<void>;
}

export function createBrowserElementCardStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
): BrowserElementCardStore {
  return {
    async list() {
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ELEMENT_CARD_STORE, "readonly");
        const values = await requestCompleted<unknown[]>(
          transaction.objectStore(ELEMENT_CARD_STORE).getAll(),
        );
        await transactionCompleted(transaction);
        return values
          .flatMap((value) => {
            const parsed = elementCardSchema.safeParse(value);
            return parsed.success ? [parsed.data] : [];
          })
          .sort(
            (left, right) =>
              left.atomicNumber - right.atomicNumber || left.id.localeCompare(right.id),
          );
      } finally {
        database.close();
      }
    },
    async remove(id) {
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ELEMENT_CARD_STORE, "readwrite");
        transaction.objectStore(ELEMENT_CARD_STORE).delete(id);
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },
    async upsert(card) {
      const parsed = elementCardSchema.parse(card);
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ELEMENT_CARD_STORE, "readwrite");
        transaction.objectStore(ELEMENT_CARD_STORE).put(parsed);
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },
  };
}
