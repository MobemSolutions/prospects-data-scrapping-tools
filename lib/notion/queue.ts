import PQueue from "p-queue";

// Notion recommande ~3 requetes/seconde en moyenne pour une integration
// interne. On limite a la fois la concurrence et le debit (intervalCap),
// contrairement a lib/pipeline/queue.ts qui ne limite que la concurrence —
// necessaire ici car un export en lot (creation + suppression de blocs +
// ajout) peut emettre une rafale de requetes en tres peu de temps.
export const notionQueue = new PQueue({ concurrency: 3, intervalCap: 3, interval: 1000 });
