export { ensureDatabaseInitialized } from './init';
export { getDb, closeDb, schema } from './client';
export { ConfigRepository, CONFIG_KEYS } from './repositories/configRepository';
export { CustomCommandRepository } from './repositories/customCommandRepository';
export { RecommendationRepository } from './repositories/recommendationRepository';
export type { Config, NewConfig, CustomCommand, NewCustomCommand, Recommendation, NewRecommendation } from './schema';
