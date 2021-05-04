export interface ManagerOptions {
  oneTimeMine: number;
}

export interface DBStats {

  [key: string]: History[]

}

interface History {
  /** Number of claimed TLM */
  claimed: number;
  /** timestamp */
  timestamp: number;
}