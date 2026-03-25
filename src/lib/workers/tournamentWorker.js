import { Worker } from "bullmq";
import { bullMQRedis } from "../queues/bullmqRedis.js";
import {
  autoStartTournamentFromDeadline,
  autoCompleteTournament,
} from "../tournament/tournamentLifecycleService.js";

const handleTournamentAutoStart = async ({ tournamentId }) => {
  await autoStartTournamentFromDeadline({ tournamentId });
};

const handleTournamentAutoComplete = async ({ tournamentId }) => {
  await autoCompleteTournament({ tournamentId });
};

const jobHandlers = {
  TOURNAMENT_AUTO_START: handleTournamentAutoStart,
  TOURNAMENT_AUTO_COMPLETE: handleTournamentAutoComplete,
};

new Worker(
  "tournamentQueue",
  async (job) => {
    const handler = jobHandlers[job.name];
    if (!handler) return;
    await handler(job.data);
  },
  { connection: bullMQRedis },
);