import { sessionPreferences } from "@/server/repositories/session-preferences";
import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import { database, type Database } from "@/server/repositories/database";
import {
  PrismaDemoSessionRepository,
  PrismaInstrumentRepository,
  PrismaKnowledgeCursorRepository,
  PrismaKnowledgeAcknowledgementRepository,
  PrismaMarketEventRepository,
  PrismaMarketSnapshotRepository,
  PrismaWatchIntentRepository,
  PrismaWatchlistRepository,
  PrismaWatchGraphRepository,
} from "@/server/repositories/prisma-repositories";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { DemoMarketService } from "@/server/services/demo-market-service";
import { InstrumentService } from "@/server/services/instrument-service";
import { MarketQueryService } from "@/server/services/market-query-service";
import { WatchIntentService } from "@/server/services/watch-intent-service";
import { WatchlistService } from "@/server/services/watchlist-service";
import { CatchUpService } from "@/server/services/catch-up-service";
import { WatchGraphService } from "@/server/services/watch-graph-service";
import { PrismaCorporateActionReviewRepository } from "@/server/repositories/corporate-action-repository";
import { CorporateActionService } from "@/server/services/corporate-action-service";
import { IntentLifecycleService } from "@/server/services/intent-lifecycle-service";

export function createServices(db: Database = database, demoSessionId = DEFAULT_DEMO_SESSION_ID) {
const instruments = new PrismaInstrumentRepository(db);
const watchlists = new PrismaWatchlistRepository(db);
const intents = new PrismaWatchIntentRepository(db);
const sessions = new PrismaDemoSessionRepository(db);
const snapshots = new PrismaMarketSnapshotRepository(db);
const events = new PrismaMarketEventRepository(db);
const cursors = new PrismaKnowledgeCursorRepository(db, demoSessionId);
const acknowledgements = new PrismaKnowledgeAcknowledgementRepository(db);
const graphs = new PrismaWatchGraphRepository(db);
const corporateReviews = new PrismaCorporateActionReviewRepository(db);
const market = new ReplayMarketProvider(sessions, snapshots, events, demoSessionId);

return {
  preferences: sessionPreferences(db),
  corporateActions: new CorporateActionService(corporateReviews, intents, market),
  instruments: new InstrumentService(instruments),
  watchlist: new WatchlistService(watchlists, instruments, intents, market, cursors),
  watchIntents: new WatchIntentService(intents, instruments, market),
  demo: new DemoMarketService(market, market),
  market: new MarketQueryService(market, watchlists),
  catchUp: new CatchUpService(watchlists, cursors, intents, sessions, market, graphs, corporateReviews, demoSessionId),
  watchGraphs: new WatchGraphService(graphs, intents, market),
  intentLifecycle: new IntentLifecycleService(intents, graphs, cursors, acknowledgements, sessions, market, demoSessionId),
};

}
/** Explicit offline legacy demo container; never imported by HTTP routes. */
export const services = createServices();
