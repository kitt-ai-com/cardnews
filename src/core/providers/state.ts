import type { Card } from "../schemas/card";

export interface StateStore {
  read(cardId: string): Promise<Card | null>;
  write(cardId: string, card: Card): Promise<void>;
  withLock<T>(cardId: string, fn: () => Promise<T>): Promise<T>;
}
