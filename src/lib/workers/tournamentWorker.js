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

const tournamentWorker = new Worker(
  "tournamentQueue",
  async (job) => {
    const handler = jobHandlers[job.name];
    if (!handler) return;
    await handler(job.data);
  },
  { connection: bullMQRedis },
);

tournamentWorker.on("completed", (job) => {
  console.log(
    `[TournamentWorker] Completed ${job.name} for tournament ${job.data?.tournamentId}`,
  );
});

tournamentWorker.on("failed", (job, error) => {
  console.error(
    `[TournamentWorker] Failed ${job?.name} for tournament ${job?.data?.tournamentId}`,
    error,
  );
});

export default tournamentWorker;